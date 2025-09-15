import { authClient } from "@/services/better-auth/client";

export async function forgotPassword(email: string) {
  const { data, error } = await authClient.forgetPassword({
    email,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    throw new Error(error.message || "Failed to send reset email");
  }

  return data;
}
