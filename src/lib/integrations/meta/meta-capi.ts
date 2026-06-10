import { createHash } from "node:crypto";

import { getLogger } from "@/lib/logger";

/**
 * Meta Conversions API (CAPI) server-side client.
 *
 * Sends events to `https://graph.facebook.com/v23.0/{PIXEL_ID}/events`.
 * - Never throws — failures are logged and swallowed so the calling flow
 *   (e.g. rental approval) is never impacted by Meta's availability.
 * - Retries transient network/5xx errors with exponential backoff.
 * - Hashes PII (email/phone) with SHA-256 per Meta's requirements before
 *   transmission. IP and user agent are sent in the clear (as required).
 */

const META_GRAPH_URL = "https://graph.facebook.com/v23.0";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;

export type MetaActionSource =
  | "website"
  | "email"
  | "app"
  | "phone_call"
  | "chat"
  | "physical_store"
  | "system_generated"
  | "other";

export interface MetaUserData {
  email?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
}

export interface SendMetaEventInput {
  eventName: string;
  /** Unix seconds. Defaults to now. */
  eventTime?: number;
  /**
   * Stable per-conversion id — guards against double-sends of the same event
   * (Meta dedupes same event_name + event_id within ~48h). For Purchase, use
   * the rental id.
   */
  eventId: string;
  eventSourceUrl?: string;
  actionSource?: MetaActionSource;
  userData?: MetaUserData;
  customData?: Record<string, unknown>;
  /** Routes the event to Events Manager's Test Events panel when set. */
  testEventCode?: string;
}

/**
 * SHA-256 hash a Meta user-data field per their normalization rules.
 *
 * Normalization (per Meta docs):
 *  - trim whitespace
 *  - lowercase
 *  - phone: strip everything except digits
 *
 * Returns undefined for empty / whitespace-only input.
 */
export function hashMetaField(
  value: string | null | undefined,
  field?: "email" | "phone" | "name",
): string | undefined {
  if (!value) return undefined;
  let normalized = value.trim().toLowerCase();
  if (field === "phone") {
    normalized = normalized.replace(/\D+/g, "");
  }
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

function buildUserData(
  userData: MetaUserData | undefined,
): Record<string, unknown> | undefined {
  if (!userData) return undefined;
  const out: Record<string, unknown> = {};

  const em = hashMetaField(userData.email, "email");
  if (em) out.em = [em];

  const ph = hashMetaField(userData.phone, "phone");
  if (ph) out.ph = [ph];

  const fn = hashMetaField(userData.firstName, "name");
  if (fn) out.fn = [fn];

  const ln = hashMetaField(userData.lastName, "name");
  if (ln) out.ln = [ln];

  if (userData.externalId) {
    out.external_id = [
      createHash("sha256").update(userData.externalId.trim()).digest("hex"),
    ];
  }
  if (userData.ip) out.client_ip_address = userData.ip;
  if (userData.userAgent) out.client_user_agent = userData.userAgent;

  return Object.keys(out).length > 0 ? out : undefined;
}

interface MetaSendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Send a single event to the Meta Conversions API.
 *
 * Never throws. Returns `{ ok: false }` on failure after retries; the calling
 * code does not need to wrap this in try/catch.
 */
export async function sendMetaEvent(
  input: SendMetaEventInput,
): Promise<MetaSendResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const logger = getLogger();

  if (!pixelId || !accessToken) {
    logger.warn(
      { event_name: input.eventName, event_id: input.eventId },
      "Meta CAPI disabled: META_PIXEL_ID or META_ACCESS_TOKEN missing",
    );
    return { ok: false, error: "meta_capi_disabled" };
  }

  const eventTime = input.eventTime ?? Math.floor(Date.now() / 1000);
  const userData = buildUserData(input.userData);

  const eventPayload: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: eventTime,
    event_id: input.eventId,
    action_source: input.actionSource ?? "website",
  };
  if (input.eventSourceUrl)
    eventPayload.event_source_url = input.eventSourceUrl;
  if (userData) eventPayload.user_data = userData;
  if (input.customData) eventPayload.custom_data = input.customData;

  const body: Record<string, unknown> = {
    data: [eventPayload],
    access_token: accessToken,
  };
  // Per-call override wins; otherwise fall back to the env code so server-only
  // events (e.g. Purchase) can be routed to the Test Events panel without
  // editing code. Leave META_TEST_EVENT_CODE unset in production.
  const testEventCode = input.testEventCode ?? process.env.META_TEST_EVENT_CODE;
  if (testEventCode) body.test_event_code = testEventCode;

  const url = `${META_GRAPH_URL}/${pixelId}/events`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) {
        logger.info(
          {
            event_name: input.eventName,
            event_id: input.eventId,
            attempt,
          },
          "Meta Event Sent",
        );
        return { ok: true, status: res.status };
      }

      // 4xx is a client error — do not retry, log and exit.
      if (res.status >= 400 && res.status < 500) {
        const text = await safeReadBody(res);
        logger.error(
          {
            event_name: input.eventName,
            event_id: input.eventId,
            status: res.status,
            response: text,
          },
          "Meta Event Failed",
        );
        return { ok: false, status: res.status, error: text };
      }

      // 5xx — fall through to retry.
      if (attempt === MAX_RETRIES) {
        const text = await safeReadBody(res);
        logger.error(
          {
            event_name: input.eventName,
            event_id: input.eventId,
            status: res.status,
            attempt,
            response: text,
          },
          "Meta Event Failed",
        );
        return { ok: false, status: res.status, error: text };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_RETRIES) {
        logger.error(
          {
            event_name: input.eventName,
            event_id: input.eventId,
            attempt,
            error,
          },
          "Meta Event Failed",
        );
        return { ok: false, error };
      }
    } finally {
      clearTimeout(timeout);
    }

    // Backoff: 250ms, 750ms.
    await sleep(250 * Math.pow(3, attempt));
  }

  return { ok: false, error: "exhausted_retries" };
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 1_000);
  } catch {
    return "<unreadable>";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Canonical (and only) Purchase event, sent from the rental approval flow
 * right after the renter's card is charged. Server-only by design: the renter
 * has no browser session when the owner approves, so there is no browser
 * Purchase to dedupe against. `event_id = rental id` still protects against
 * double-sends (e.g. approval retries).
 */
export function sendMetaPurchase(input: {
  bookingId: string;
  value: number;
  currency?: string;
  contentIds?: string[];
  userData?: MetaUserData;
  eventSourceUrl?: string;
}): Promise<MetaSendResult> {
  const customData: Record<string, unknown> = {
    value: input.value,
    currency: input.currency ?? "USD",
  };
  if (input.contentIds?.length) {
    customData.content_ids = input.contentIds;
    customData.content_type = "product";
  }
  return sendMetaEvent({
    eventName: "Purchase",
    eventId: input.bookingId,
    actionSource: "website",
    eventSourceUrl: input.eventSourceUrl,
    userData: input.userData,
    customData,
  });
}
