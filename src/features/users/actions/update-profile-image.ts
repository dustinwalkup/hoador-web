"use server";

import { revalidatePath } from "next/cache";
import { userDAL } from "@/dal";
import { getCurrentUser } from "@/features/auth/utils/session";

interface UpdateProfileImageResult {
  success: boolean;
  error?: string;
}

export async function updateProfileImageAction(
  profileImageUrl: string,
): Promise<UpdateProfileImageResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: "You must be logged in to update your profile image.",
      };
    }

    await userDAL.updateCurrentUser(user.id, { profileImageUrl });

    // Revalidate the profile page to show updated image
    revalidatePath("/dashboard/profile");

    return { success: true };
  } catch (error) {
    console.error("Profile image update failed:", error);

    if (error instanceof Error) {
      if (error.message?.includes("Unauthorized")) {
        return {
          success: false,
          error: "You don't have permission to update this profile.",
        };
      }

      if (error.message?.includes("not found")) {
        return {
          success: false,
          error: "User account not found.",
        };
      }
    }

    return {
      success: false,
      error: "Failed to update profile image. Please try again.",
    };
  }
}
