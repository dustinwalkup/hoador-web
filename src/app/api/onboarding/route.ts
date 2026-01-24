import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";
import { onboardingSchema } from "@/features/onboarding/schemas/validation";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";

/**
 * Complete user onboarding
 * POST /api/onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse form data
    const body = await parseFormData(request);

    // Extract and structure form data
    const userData = {
      firstName: (body.firstName as string) || "",
      lastName: (body.lastName as string) || "",
      phone: (body.phone as string) || "",
      bio: (body.bio as string) || "",
      profileImageUrl: (body.profileImageUrl as string) || "",
      address: {
        street: (body.street as string) || "",
        city: (body.city as string) || "",
        state: (body.state as string) || "",
        zipCode: (body.zipCode as string) || "",
      },
      agreeToTerms:
        body.agreeToTerms === "on" ||
        body.agreeToTerms === "true" ||
        body.agreeToTerms === true,
    };

    // Validate with schema
    let validatedData;
    try {
      validatedData = onboardingSchema.parse(userData);
    } catch {
      return NextResponse.json(
        { error: "Please check your information and try again." },
        { status: 400 },
      );
    }

    // Separate address from user profile data
    const { address, ...profileData } = validatedData;

    // Step 1: Update user profile (critical - must succeed)
    const { data: updatedUser, error: userError } = await tryCatch(
      userDAL.updateUser(userId, {
        ...profileData,
        status: "active" as const,
      }),
    );

    if (userError) {
      console.error("User profile update error:", userError);

      if (userError.message?.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "You don't have permission to update this profile." },
          { status: 403 },
        );
      }

      if (userError.message?.includes("not found")) {
        return NextResponse.json(
          { error: "User account not found." },
          { status: 404 },
        );
      }

      return handleApiError(userError);
    }

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Failed to update user profile. Please try again." },
        { status: 500 },
      );
    }

    // Step 2: Update address (non-critical, log warning if fails)
    if (
      address &&
      address.street &&
      address.city &&
      address.state &&
      address.zipCode
    ) {
      const { error: addressError } = await tryCatch(
        userDAL.updateUserPrimaryAddress(userId, address),
      );

      if (addressError) {
        console.warn("Address update failed during onboarding:", addressError);
        // Don't fail the request, but return a warning
        return NextResponse.json({
          success: true,
          redirect: "/dashboard",
          warning:
            "Profile updated, but address update failed. You can update it later.",
        });
      }
    }

    // Success! Return redirect URL
    return NextResponse.json({
      success: true,
      redirect: "/dashboard",
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
