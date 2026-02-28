import { authClient } from "@/services/better-auth/client";

/** Default redirect after login when no valid callback is provided */
const DEFAULT_CALLBACK_PATH = "/dashboard";

/**
 * Validates callbackUrl to prevent open redirects. Allows only same-origin
 * relative paths (e.g. /dashboard, /join-code). Rejects absolute URLs,
 * protocol-relative (//evil.com), and other schemes (e.g. javascript:).
 */
export function getSafeCallbackUrl(callbackUrl: string | null): string {
  if (!callbackUrl || typeof callbackUrl !== "string") {
    return DEFAULT_CALLBACK_PATH;
  }
  const trimmed = callbackUrl.trim();
  if (
    trimmed === "" ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes(":")
  ) {
    return DEFAULT_CALLBACK_PATH;
  }
  return trimmed;
}

export async function signOut(redirectTo?: string): Promise<void> {
  await authClient.signOut();

  // Small delay to ensure the signOut request is fully processed
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Force a full page redirect to ensure clean state and bypass any middleware issues
  if (redirectTo) {
    window.location.href = redirectTo;
  }
}

export async function signInEmail(
  email: string,
  password: string,
  callbackUrl?: string,
): Promise<void> {
  const { error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: callbackUrl,
  });

  if (error) {
    // Better Auth returns structured error responses
    throw new Error(error.message || "Invalid email or password");
  }

  // Success - authentication completed
}

export async function signInSocial(
  provider: string,
  callbackUrl?: string,
): Promise<void> {
  const { error } = await authClient.signIn.social({
    provider,
    callbackURL: callbackUrl,
  });

  if (error) {
    throw new Error(error.message || "Failed to sign in with social provider");
  }
}
