import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { notificationCategoryPreferencesDAL, userDAL } from "@/dal";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { getCategoryPreferences } from "@/features/notifications/lib/preference-service";
import {
  handleApiError,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { patchPreferencesBodySchema } from "@/features/notifications/lib/validators";
import type { CategoryPreferencesInput } from "@/dal/notifications.dal";

/**
 * GET /api/notifications/preferences
 * Return master and per-category notification preferences for the authenticated user.
 * Requirements: 1.6, 6.1
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

    const preferences = await getCategoryPreferences(userId);
    return NextResponse.json(preferences);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/notifications/preferences",
);

/**
 * PATCH /api/notifications/preferences
 * Update per-category notification preferences for the authenticated user.
 * Body: { categories: { [category]: { email?, push? } } }
 * Requirements: 1.6, 6.3
 */
async function patchHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    console.log("PATCH /api/notifications/preferences");

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

    const parsed = patchPreferencesBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (parsed.data.master) {
      const { email, push } = parsed.data.master;
      const updates: {
        emailNotifications?: boolean;
        pushNotifications?: boolean;
      } = {};
      if (typeof email === "boolean") updates.emailNotifications = email;
      if (typeof push === "boolean") updates.pushNotifications = push;
      if (Object.keys(updates).length > 0) {
        await userDAL.updateUserPreferences(userId, updates);
      }
    }

    const categories = parsed.data.categories as CategoryPreferencesInput;
    if (categories && Object.keys(categories).length > 0) {
      await notificationCategoryPreferencesDAL.upsertMany(userId, categories);
    }

    trackActivity(userId, "settings_updated");

    const updated = await getCategoryPreferences(userId);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/notifications/preferences",
);
