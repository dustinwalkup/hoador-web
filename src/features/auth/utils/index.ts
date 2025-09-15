import { authClient } from "@/services/better-auth/client";

export async function signOut(): Promise<void> {
  await authClient.signOut();
}

export async function signInEmail(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await authClient.signIn.email({
    email,
    password,
  });

  if (error) {
    // Better Auth returns structured error responses
    throw new Error(error.message || "Invalid email or password");
  }

  // Success - authentication completed
}

export async function signInSocial(provider: string): Promise<void> {
  await authClient.signIn.social({
    provider,
  });
}
