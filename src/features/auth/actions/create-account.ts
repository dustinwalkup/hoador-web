"use server";

import { emailSignupServerSchema } from "../schemas/validation";

// Placeholder DAL functions - replace with actual database implementations
async function findCommunityByJoinCode(joinCode: string) {
  // TODO: Implement database query to find community by join code
  // Example: SELECT * FROM communities WHERE join_code = ? AND active = true
  console.log(`[DAL] Finding community with join code: ${joinCode}`);

  // Temporary mock data for development
  if (joinCode === "demo123") {
    return {
      id: "community-1",
      name: "Demo Community",
      joinCode: "demo123",
      active: true,
    };
  }
  return null;
}

async function createUser(userData: any) {
  // TODO: Implement database insert for new user
  // Example: INSERT INTO users (first_name, last_name, email, password_hash, phone, address, city, state, zip_code, community_id) VALUES (...)
  console.log(`[DAL] Creating user:`, userData);

  // Temporary mock implementation
  const userId = `user-${Date.now()}`;
  return {
    id: userId,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
  };
}

async function sendConfirmationEmail(email: string, userId: string) {
  // TODO: Implement email service integration (SendGrid, AWS SES, etc.)
  // Example: Send email with confirmation token/link
  console.log(
    `[DAL] Sending confirmation email to: ${email} for user: ${userId}`,
  );

  // Temporary mock implementation
  return {
    success: true,
    messageId: `msg-${Date.now()}`,
  };
}

export async function createAccountAction(prevState: any, formData: FormData) {
  try {
    const userData = {
      joinCode: (formData.get("joinCode") as string) || "",
      firstName: (formData.get("firstName") as string) || "",
      lastName: (formData.get("lastName") as string) || "",
      email: (formData.get("email") as string) || "",
      password: (formData.get("password") as string) || "",
      phone: (formData.get("phone") as string) || "",
      address: {
        street: (formData.get("street") as string) || "",
        city: (formData.get("city") as string) || "",
        state: (formData.get("state") as string) || "",
        zipCode: (formData.get("zipCode") as string) || "",
      },
      agreeToTerms:
        formData.get("agreeToTerms") === "on" ||
        formData.get("agreeToTerms") === "true",
    };

    // Validate all data
    const validatedData = emailSignupServerSchema.parse(userData);

    // Verify community still exists
    const community = await findCommunityByJoinCode(validatedData.joinCode);
    if (!community) {
      return {
        success: false,
        error: "Community no longer available.",
      };
    }

    // TODO: Hash password before storing
    // Example: const passwordHash = await bcrypt.hash(validatedData.password, 12)

    // Create user account
    const user = await createUser({
      ...validatedData,
      communityId: community.id,
      // passwordHash, // Use hashed password instead of plain text
    });

    // Send confirmation email
    const emailResult = await sendConfirmationEmail(user.email, user.id);

    if (!emailResult.success) {
      // TODO: Handle email sending failure - maybe queue for retry
      console.error("Failed to send confirmation email");
    }

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
    };
  } catch (error) {
    console.log("Account creation error:", error);
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }
}
