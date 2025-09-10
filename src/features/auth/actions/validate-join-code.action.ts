"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { communityDAL } from "@/dal";
import { joinCodeSchema } from "../form-schema/signup-schema";

/**
 * Server action to validate a community join code
 * Returns community information if valid, null if invalid
 */
interface CommunityInfo {
  id: string;
  name: string;
  imageUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export async function validateJoinCodeAction(
  prevState: { success: boolean; error?: string; community?: CommunityInfo },
  formData: FormData,
): Promise<{ success: boolean; error?: string; community?: CommunityInfo }> {
  const { data, error } = await tryCatch(
    (async () => {
      // Extract and validate join code from form data
      const joinCode = formData.get("joinCode") as string;

      if (!joinCode) {
        throw new Error("Join code is required");
      }

      // Validate input with Zod schema
      const validatedInput = joinCodeSchema.parse({ joinCode });

      // Check if community exists with this join code
      const community = await communityDAL.validateJoinCodeForSignup(
        validatedInput.joinCode,
      );

      if (!community) {
        throw new Error("Invalid join code. Please check and try again.");
      }

      return {
        success: true,
        community: {
          id: community.id,
          name: community.name,
          imageUrl: community.imageUrl,
          address: community.address,
          city: community.city,
          state: community.state,
          zip: community.zip,
        },
      };
    })(),
  );

  if (error) {
    console.error("Join code validation failed:", error);
    return {
      success: false,
      error: error.message || "Failed to validate join code",
    };
  }

  return data as { success: boolean; community: CommunityInfo };
}
