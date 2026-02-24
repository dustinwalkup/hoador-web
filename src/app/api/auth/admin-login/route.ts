import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { auth } from "@/services/better-auth";
import { getAdminUser } from "@/features/auth/utils/admin-session";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  parseFormData,
  getClientIP,
} from "@/lib/api/route-helpers";
import { getLogger } from "@/lib/logger";
import { auditLogDAL } from "@/dal";
import { recordFailedAuth } from "@/lib/auth/failed-auth-store";

async function postHandler(request: NextRequest) {
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
      getLogger().warn(
        { message: "auth.failed", identifierType: "email" },
        "Authentication failed",
      );
      const ip = getClientIP(request);
      if (ip) {
        recordFailedAuth(ip);
      }
      recordFailedAuth(`email:${email}`);
      await auditLogDAL.create({
        entityType: "auth",
        entityId: "admin-login",
        action: "auth.failed",
        metadata: { identifierType: "email" },
        ipAddress: ip ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
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
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/admin-login",
);
