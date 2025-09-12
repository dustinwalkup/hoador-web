"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { communityDAL } from "@/dal";
import { ValidationError } from "@/dal/errors";
import { joinCodeSchema } from "../schemas/validation";

type ValidationResult = {
  success: boolean;
  error?: string;
  data?: {
    community: {
      id: string;
      name: string;
    };
  };
};

export async function validateJoinCodeAction(
  prevState: ValidationResult | null,
  formData: FormData,
): Promise<ValidationResult> {
  const joinCode = formData.get("joinCode") as string;

  // Validate join code format first
  try {
    joinCodeSchema.parse({ joinCode });
  } catch {
    return {
      success: false,
      error: "Invalid join code format.",
    };
  }

  // Check if community exists with this join code using DAL
  const { data: community, error } = await tryCatch(
    communityDAL.validateJoinCodeForSignup(joinCode.trim()),
  );

  if (error) {
    console.error("Join code validation error:", error);

    // Handle specific validation errors
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Generic error for database or other issues
    return {
      success: false,
      error: "Unable to validate join code. Please try again.",
    };
  }

  if (!community) {
    return {
      success: false,
      error:
        "Invalid join code. Please check with your community administrator.",
    };
  }

  return {
    success: true,
    data: {
      community: {
        id: community.id,
        name: community.name,
      },
    },
  };
}
