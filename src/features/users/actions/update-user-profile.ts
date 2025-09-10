"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../auth/auth.utils";
import { userDAL } from "../../../dal";

const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(4).max(10),
  }),
});

export async function updateUserProfileAndAddress(formData: unknown) {
  const user = await getCurrentUser();

  const userId = user?.id;
  if (!userId) return { error: "Unauthorized" };

  const result = UpdateUserProfileSchema.safeParse(formData);
  if (!result.success) {
    return { error: "Invalid input", details: result.error.flatten() };
  }

  const { address, ...userFields } = result.data;

  try {
    await Promise.all([
      userDAL.updateUser(userId, userFields),
      userDAL.updateUserPrimaryAddress(userId, address),
    ]);

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Profile update failed:", error);
    return { error: "Profile update failed" };
  }
}
