import { NextRequest, NextResponse } from "next/server";
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
} from "@/features/notifications/lib/validators";

/**
 * GET /api/push/subscribe
 * Returns whether the authenticated user has at least one active push subscription.
 */
export async function GET(): Promise<NextResponse> {
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

/**
 * POST /api/push/subscribe
 * Register a push subscription for the authenticated user.
 * Requirements: 3.8, 3.6
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
            "Invalid payload: endpoint and keys.p256dh and keys.auth required",
        },
        { status: 400 },
      );
    }

    const webPushSubscription: WebPushSubscription = {
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      expirationTime: parsed.data.expirationTime ?? undefined,
    };
    const userAgent = request.headers.get("user-agent") ?? undefined;

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

/**
 * DELETE /api/push/subscribe
 * Deactivate a push subscription for the authenticated user.
 * Requirements: 3.5
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
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
        { error: "Invalid payload: endpoint required" },
        { status: 400 },
      );
    }

    const existing = await pushSubscriptionDAL.getByEndpoint(
      parsed.data.endpoint,
    );
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: "Subscription not found or access denied" },
        { status: 404 },
      );
    }

    await pushSubscriptionDAL.deactivate(existing.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
