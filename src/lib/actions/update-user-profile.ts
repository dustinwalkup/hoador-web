// app/actions/update-user-profile.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { UserDAL } from "../dal/user.dal";
import { getCurrentUser } from "../auth/get-current-user";

const dal = new UserDAL();

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
  console.log("user", user);
  const userId = user?.id;
  if (!userId) return { error: "Unauthorized" };

  const result = UpdateUserProfileSchema.safeParse(formData);
  if (!result.success) {
    return { error: "Invalid input", details: result.error.flatten() };
  }

  const { address, ...userFields } = result.data;

  try {
    await Promise.all([
      dal.updateUser(userId, userFields),
      dal.updateUserPrimaryAddress(userId, address),
    ]);

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Profile update failed:", error);
    return { error: "Profile update failed" };
  }
}
