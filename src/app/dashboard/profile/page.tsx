import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ProfileTabs } from "./_components/profile-tabs";
import { ProfileOverview } from "./_components/profile-overview";
import { EditModeProvider } from "@/lib/contexts/edit-mode-context";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return notFound();
  return (
    <EditModeProvider>
      {/* This is to keep ProfileOverview as a server component */}
      <ProfileTabs profileOverview={<ProfileOverview user={user} />} />
    </EditModeProvider>
  );
}
