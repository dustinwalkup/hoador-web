import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { pushSubscriptionDAL } from "@/dal";
import {
  handleApiError,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import type { WebPushSubscription } from "@/dal/notifications.dal";
import {
  subscribeBodySchema,
  unsubscribeBodySchema,
  isNativeSubscribeBody,
} from "@/features/notifications/lib/validators";

/**
 * GET /api/push/subscribe
 * Returns whether the authenticated user has at least one active push subscription.
 */
async function getHandler(): Promise<NextResponse> {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const subscriptions = await pushSubscriptionDAL.getActiveByUserId(userId);
    return NextResponse.json({
      subscribed: subscriptions.length > 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/push/subscribe");

/**
 * POST /api/push/subscribe
 * Register a push subscription for the authenticated user.
 * Requirements: 3.8, 3.6
 */
async function postHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = subscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid payload: expected { platform, token } for native or " +
            "{ endpoint, keys: { p256dh, auth } } for web",
        },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get("user-agent") ?? undefined;

    // Native (Expo) subscription — the mobile app. Requirements: 2.2.1.
    if (isNativeSubscribeBody(parsed.data)) {
      const nativeRow = await pushSubscriptionDAL.createNative(
        userId,
        { platform: parsed.data.platform, token: parsed.data.token },
        userAgent,
      );
      return NextResponse.json(
        { id: nativeRow.id, platform: nativeRow.platform },
        { status: 201 },
      );
    }

    // Web Push subscription — the PWA. Unchanged behavior and response shape.
    const webPushSubscription: WebPushSubscription = {
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      expirationTime: parsed.data.expirationTime ?? undefined,
    };

    const row = await pushSubscriptionDAL.create(
      userId,
      webPushSubscription,
      userAgent,
    );
    if (!row) {
      return handleApiError(new Error("Failed to create push subscription"));
    }

    return NextResponse.json(
      { id: row.id, endpoint: row.endpoint },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/push/subscribe");

/**
 * DELETE /api/push/subscribe
 * Deactivate a push subscription for the authenticated user.
 * Requirements: 3.5
 */
async function deleteHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = unsubscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload: exactly one of endpoint or token required" },
        { status: 400 },
      );
    }

    const { endpoint, token } = parsed.data;
    const existing = token
      ? await pushSubscriptionDAL.getByToken(token)
      : await pushSubscriptionDAL.getByEndpoint(endpoint!);

    // Ownership is enforced before deactivating: without it, knowing a token
    // would be enough to silence another user's device.
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: "Subscription not found or access denied" },
        { status: 404 },
      );
    }

    if (token) {
      // Token-scoped: collapses any duplicate rows for the same device.
      await pushSubscriptionDAL.deactivateByToken(token);
    } else {
      await pushSubscriptionDAL.deactivate(existing.id);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/push/subscribe",
);
