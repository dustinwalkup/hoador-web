import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "expo-server-sdk";
import { pushSubscriptionDAL } from "@/dal";
import type { PushSubscriptionRow } from "@/dal/notifications.dal";
import { getLogger } from "@/lib/logger";
import type { PushPayload } from "./push-payload";

/**
 * Native push delivery via the Expo Push API.
 *
 * The web-push/VAPID path lives in `push-service.ts` and stays untouched until
 * the post-GA decommission (Requirement 2.2.7). `sendPush` owns the fan-out and
 * calls in here for `ios`/`android` subscriptions.
 *
 * Requirements: 2.2.2–2.2.5
 * Design: 2-design.md §4.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.2.1
 */

const EVENT_TYPE_PUSH_SEND = "push_send";
const LOG_PUSH_DEBUG = process.env.LOG_PUSH_DEBUG === "true";

/** Expo's hard ceiling for a single push message. */
const EXPO_MAX_PAYLOAD_BYTES = 4096;

let expoClient: Expo | null = null;

/**
 * Lazily construct the Expo client.
 *
 * `EXPO_ACCESS_TOKEN` is optional — it is only required when push security is
 * enabled for the project in the EAS dashboard. Unlike VAPID for web push,
 * there is no env precondition that can disable native sends, so there is no
 * "not configured" early-return here by design.
 */
function getExpoClient(): Expo {
  if (!expoClient) {
    expoClient = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN?.trim() || undefined,
    });
  }
  return expoClient;
}

/** Test seam: drop the memoized client so env changes take effect. */
export function resetExpoClientForTests(): void {
  expoClient = null;
}

/**
 * Map an internal push payload to an Expo message.
 *
 * `linkUrl` rides inside `data` rather than at the top level: the mobile app
 * maps `data` → a native route via `deep-links.ts` (Requirement 2.6.4), and
 * Expo only delivers `data` to the app. The payload is already PII-free —
 * `buildPushPayload` allowlists reference IDs (Requirement 2.2.3) — so it is
 * passed through rather than re-filtered here.
 */
function toExpoMessage(token: string, payload: PushPayload): ExpoPushMessage {
  return {
    to: token,
    title: payload.title,
    body: payload.body,
    sound: "default",
    data: { ...payload.data, linkUrl: payload.linkUrl },
  };
}

/**
 * Deliver a payload to every native subscription for a user.
 *
 * Errors are contained per-chunk: one chunk failing must not stop the rest, and
 * a native failure must never surface to the caller — notifications are
 * fire-and-forget and must never fail a money operation.
 *
 * @param userId - Recipient, for audit rows and logging context
 * @param rows - Active native subscriptions (already narrowed to have a token)
 * @param payload - PII-free payload from `buildPushPayload`
 */
export async function sendExpoPush(
  userId: string,
  rows: (PushSubscriptionRow & { token: string })[],
  payload: PushPayload,
): Promise<void> {
  if (!rows.length) return;

  const expo = getExpoClient();
  const eventType = payload.data?.type ?? EVENT_TYPE_PUSH_SEND;

  // Resolve a ticket back to the subscription it came from. Tickets align with
  // messages positionally within a chunk, and every message carries its token
  // in `to`, so the token is the join key.
  const rowByToken = new Map(rows.map((r) => [r.token, r]));

  const messages = rows.map((r) => toExpoMessage(r.token, payload));

  const oversized = messages.filter(
    (m) =>
      Buffer.byteLength(JSON.stringify(m), "utf8") > EXPO_MAX_PAYLOAD_BYTES,
  );
  if (oversized.length) {
    // Expo rejects the whole chunk, so send nothing rather than poison a batch
    // of otherwise-valid messages. Payloads are template-generated and PII-free,
    // so this means a template regressed — worth an error, not a silent drop.
    getLogger({ userId }).error(
      {
        event: "expo_push_payload_too_large",
        userId,
        eventType,
        limitBytes: EXPO_MAX_PAYLOAD_BYTES,
      },
      "[expo-push] payload exceeds Expo's size limit; not sending",
    );
    await Promise.all(
      oversized.map((m) =>
        pushSubscriptionDAL.createAuditLog(
          userId,
          rowByToken.get(String(m.to))?.id ?? null,
          eventType,
          false,
          `Payload exceeds Expo limit of ${EXPO_MAX_PAYLOAD_BYTES} bytes`,
        ),
      ),
    );
    return;
  }

  // Expo caps a send at 100 messages; chunking is the SDK's job, not ours.
  const chunks = expo.chunkPushNotifications(messages);

  if (LOG_PUSH_DEBUG) {
    getLogger({ userId }).info(
      {
        event: "expo_push_dispatch",
        userId,
        subscriptionCount: rows.length,
        chunkCount: chunks.length,
      },
      "[expo-push] dispatching native push",
    );
  }

  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      // Transport-level failure: the whole chunk is unaccounted for. Audit each
      // message in it so the send is not silently lost, then carry on with the
      // remaining chunks.
      getLogger({ userId }).error(
        { err, event: "expo_push_chunk_failed", userId },
        "[expo-push] chunk send failed",
      );
      await Promise.all(
        chunk.map((m) =>
          pushSubscriptionDAL.createAuditLog(
            userId,
            rowByToken.get(String(m.to))?.id ?? null,
            eventType,
            false,
            err instanceof Error ? err.message : String(err),
          ),
        ),
      );
      continue;
    }

    await Promise.all(
      tickets.map((ticket, i) =>
        handleTicket(
          userId,
          eventType,
          rowByToken.get(String(chunk[i]?.to)),
          ticket,
        ),
      ),
    );
  }
}

/**
 * Expo publishes receipts a few minutes after a send. Checking sooner burns a
 * request for nothing. Docs say ~15 min; the SDK's README says up to 30 under
 * load — the two official sources disagree, so this is the floor and the cron's
 * hourly cadence absorbs the rest.
 */
const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;

/**
 * Receipts are retained "approximately a day". Past that they are unknowable,
 * so tickets are expired rather than re-queried forever. Deliberately under 24h
 * so an hourly run cannot skip the last viable window.
 */
const RECEIPT_MAX_AGE_MS = 23 * 60 * 60 * 1000;

/** Bounds one cron run. Anything not covered is picked up an hour later. */
const RECEIPT_BATCH_LIMIT = 3000;

export interface ReceiptCheckResult {
  checked: number;
  ok: number;
  errored: number;
  deactivated: number;
  expired: number;
}

/**
 * Resolve outstanding Expo push receipts and prune dead devices.
 *
 * This is the second of the two places `DeviceNotRegistered` surfaces — the
 * ticket path in `handleTicket` catches devices Expo already knows are gone;
 * this catches the ones only APNs/FCM discover, which is the majority.
 * Parity with the web path's 410/404 pruning. Requirements: 2.2.4.
 */
export async function checkExpoPushReceipts(): Promise<ReceiptCheckResult> {
  const expo = getExpoClient();
  const result: ReceiptCheckResult = {
    checked: 0,
    ok: 0,
    errored: 0,
    deactivated: 0,
    expired: 0,
  };

  const pending = await pushSubscriptionDAL.getPendingReceipts({
    olderThanMs: RECEIPT_MIN_AGE_MS,
    youngerThanMs: RECEIPT_MAX_AGE_MS,
    limit: RECEIPT_BATCH_LIMIT,
  });

  if (pending.length) {
    const auditByTicketId = new Map(pending.map((p) => [p.expoTicketId, p]));
    // Expo caps a receipt lookup at 300 ids per request.
    const chunks = expo.chunkPushNotificationReceiptIds(
      pending.map((p) => p.expoTicketId),
    );

    for (const chunk of chunks) {
      let receipts: Awaited<
        ReturnType<typeof expo.getPushNotificationReceiptsAsync>
      >;
      try {
        receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      } catch (err) {
        // Leave the rows `pending` so the next run retries them — they stay
        // inside the retention window for ~23h.
        getLogger().error(
          { err, event: "expo_receipt_chunk_failed" },
          "[expo-push] receipt lookup failed",
        );
        continue;
      }

      for (const [ticketId, receipt] of Object.entries(receipts)) {
        const audit = auditByTicketId.get(ticketId);
        if (!audit) continue;
        result.checked += 1;

        if (receipt.status === "ok") {
          await pushSubscriptionDAL.resolveReceipt(audit.id, "ok");
          result.ok += 1;
          continue;
        }

        await pushSubscriptionDAL.resolveReceipt(
          audit.id,
          "error",
          receipt.message,
        );
        result.errored += 1;

        if (receipt.details?.error !== "DeviceNotRegistered") continue;

        // The receipt names the dead token directly, which is what we need:
        // the audit row's subscription may already be gone (`ON DELETE SET
        // NULL`), and the token is the durable identifier either way.
        const token = receipt.details?.expoPushToken;
        if (!token) continue;

        await pushSubscriptionDAL.deactivateByToken(token);
        result.deactivated += 1;
        getLogger().info(
          {
            event: "expo_push_device_not_registered",
            auditId: audit.id,
            source: "receipt",
          },
          "[expo-push] deactivated subscription: DeviceNotRegistered",
        );
      }
    }
  }

  result.expired =
    await pushSubscriptionDAL.expireStaleReceipts(RECEIPT_MAX_AGE_MS);

  return result;
}

/**
 * Record a ticket and prune the subscription if Expo already rejected it.
 *
 * `DeviceNotRegistered` arrives at *two* points — here at send time, and later
 * on the receipt (the ticket and receipt error shapes are identical in the SDK).
 * Handling it only on receipts is a common bug that leaves dead tokens live for
 * an extra hour; both sites deactivate. Requirements: 2.2.4.
 */
async function handleTicket(
  userId: string,
  eventType: string,
  row: (PushSubscriptionRow & { token: string }) | undefined,
  ticket: ExpoPushTicket,
): Promise<void> {
  const subscriptionId = row?.id ?? null;

  if (ticket.status === "ok") {
    // Accepted, not delivered: only the receipt (task 2.2.2) confirms delivery,
    // which is why the row lands as `pending` rather than a bare success.
    await pushSubscriptionDAL.createAuditLog(
      userId,
      subscriptionId,
      eventType,
      true,
      null,
      { expoTicketId: ticket.id, receiptStatus: "pending" },
    );
    return;
  }

  const errorCode = ticket.details?.error;

  await pushSubscriptionDAL.createAuditLog(
    userId,
    subscriptionId,
    eventType,
    false,
    ticket.message,
    { expoTicketId: null, receiptStatus: "error" },
  );

  if (errorCode === "DeviceNotRegistered" && row) {
    // Parity with the web path's 410/404 pruning.
    await pushSubscriptionDAL.deactivateByToken(row.token);
    getLogger({ userId }).info(
      {
        event: "expo_push_device_not_registered",
        userId,
        subscriptionId,
        source: "ticket",
      },
      "[expo-push] deactivated subscription: DeviceNotRegistered",
    );
  }
}
