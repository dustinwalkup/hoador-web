import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ProfileTabs } from "./_components/profile-tabs";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return notFound();
  return <ProfileTabs user={user} />;
}
