import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/services/better-auth";
import { getAdminUser } from "@/features/auth/utils/admin-session";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await parseFormData(request);
    const email = body.email as string;
    const password = body.password as string;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Authenticate user using Better Auth server API
    const { error: authError } = await tryCatch(
      auth.api.signInEmail({
        body: {
          email,
          password,
        },
        headers: request.headers,
      }),
    );

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: authError.message || "Invalid email or password",
        },
        { status: 401 },
      );
    }

    // Check if user is admin
    const adminUser = await getAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 },
      );
    }

    // Success
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
