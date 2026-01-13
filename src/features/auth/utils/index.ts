import { authClient } from "@/services/better-auth/client";
import { clearServiceWorkerCache } from "@/lib/pwa/register-service-worker";

export async function signOut(redirectTo?: string): Promise<void> {
  await authClient.signOut();

  // Clear service worker cache to remove any cached sensitive data
  try {
    await clearServiceWorkerCache();
  } catch (error) {
    // Don't block logout if cache clearing fails
    console.warn("[Auth] Failed to clear service worker cache:", error);
  }

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
