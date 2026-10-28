/**
 * Stop pushes to the devices a session revocation signs out (UAT E2E-015).
 *
 * A device signed out by someone else's revocation learns of it from a 401,
 * and by then it has no cookie to unsubscribe with, so its subscription stayed
 * active and it kept receiving the account's pushes. `push_subscriptions` has
 * no session column, so the server can't map a revoked session to its device;
 * instead the request that revokes does the deactivation itself, sparing only
 * the device that keeps its session. That device says which it is by sending
 * its own Expo token as `pushToken` (the mobile app does, on a password
 * change). Without one every subscription goes: failing closed is right, and
 * the app re-registers on its next sign-in.
 *
 * Password reset is handled from `onPasswordReset` (no session there, and it
 * revokes every session); admin suspension in `userDAL.adminUpdateUser`.
 */

/** Body field naming the calling device's Expo push token. */
export const KEEP_PUSH_TOKEN_FIELD = "pushToken";

/**
 * better-auth endpoints that revoke sessions, and whether the caller keeps its
 * own. `/change-password` always revokes the others (forced in the `before`
 * hook) and rotates the caller's. `/revoke-session` (one session, by token) is
 * not here: nothing maps a session token to a device.
 */
const REVOKING_PATHS: Record<string, "others" | "all"> = {
  "/change-password": "others",
  "/revoke-other-sessions": "others",
  "/revoke-sessions": "all",
};

/** The slice of a better-auth hook context this reads. */
export type RevocationHookContext = {
  path?: string;
  body?: unknown;
  context: {
    session?: { user?: { id?: string } } | null;
    returned?: unknown;
  };
};

function readKeepToken(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[KEEP_PUSH_TOKEN_FIELD];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Deactivate a user's push subscriptions, all or all but one device's.
 *
 * Never throws. It runs inside password flows whose real work is already
 * done: a throw from a `/change-password` after-hook would drop the rotated
 * cookie and sign the caller out too, and one from `onPasswordReset` would
 * skip the session revocation that follows it.
 */
export async function deactivatePushForUser(
  userId: string,
  exceptToken: string | undefined,
  route: string,
): Promise<void> {
  try {
    // Imported here: `@/dal` opens the database client at module load, and the
    // auth config must stay buildable without one (see `__tests__/`).
    const { pushSubscriptionDAL } = await import("@/dal");
    await pushSubscriptionDAL.deactivateAllForUser(userId, { exceptToken });
  } catch (error) {
    // Imported here too: route-helpers reaches this module's own auth
    // instance through the session helpers.
    const { captureNonCriticalError } = await import("@/lib/api/route-helpers");
    captureNonCriticalError(error, {
      route,
      action: "deactivate push for revoked sessions",
    });
  }
}

/** The `hooks.after` half: runs after every better-auth endpoint. */
export async function deactivatePushAfterRevocation(
  ctx: RevocationHookContext,
): Promise<void> {
  const scope = ctx.path ? REVOKING_PATHS[ctx.path] : undefined;
  if (!scope) return;
  // A refused request (wrong password, stale session) revoked nothing.
  if (ctx.context.returned instanceof Error) return;
  const userId = ctx.context.session?.user?.id;
  if (!userId) return;

  const exceptToken = scope === "others" ? readKeepToken(ctx.body) : undefined;
  await deactivatePushForUser(userId, exceptToken, ctx.path!);
}
