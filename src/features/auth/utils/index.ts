import { authClient } from "@/services/better-auth/client";

export async function signOut(): Promise<void> {
  await authClient.signOut();
}

export async function signInEmail(
  email: string,
  password: string,
): Promise<void> {
  await authClient.signIn.email({
    email,
    password,
  });
}

export async function signInSocial(provider: string): Promise<void> {
  await authClient.signIn.social({
    provider,
  });
}
