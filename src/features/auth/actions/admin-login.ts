"use server";

import { headers } from "next/headers";
import { auth } from "@/services/better-auth";
import { getAdminUser } from "../utils/admin-session";
import { tryCatch } from "@walkup/walkup-utils";

export interface AdminLoginState {
  error?: string;
  success?: boolean;
}

export async function adminLoginAction(
  prevState: AdminLoginState | null,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return {
      error: "Email and password are required",
    };
  }

  // Authenticate user using Better Auth server API
  const { error: authError } = await tryCatch(
    auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
    }),
  );

  if (authError) {
    return {
      error: authError.message || "Invalid email or password",
    };
  }

  // Check if user is admin
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return {
      error: "Access denied. Admin privileges required.",
    };
  }

  // Success
  return { success: true };
}
