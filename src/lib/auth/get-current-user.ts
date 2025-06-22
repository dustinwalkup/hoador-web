// lib/auth/getCurrentUser.ts
import { userDAL } from "@/lib/dal"; // singleton instance of UserDAL

export async function getCurrentUser() {
  // 🔧 Replace this with Clerk auth later
  const USER_ID = "2a72dc81-8a13-4174-b79f-bb22096db6cb";

  // You could hardcode or use cookies/session logic for local dev
  return userDAL.getUserById(USER_ID);
}
