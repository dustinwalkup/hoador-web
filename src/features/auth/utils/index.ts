import { authClient } from "@/services/better-auth/client";

export async function signOut(): Promise<void> {
  await authClient.signOut();
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
