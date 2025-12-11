export const dynamic = "force-dynamic";

import { NotificationsPageContent } from "@/features/notifications/components/notifications-page-content";

export const metadata = {
  title: "Notifications | Hoador",
  description: "View and manage your notifications",
};

export default function NotificationsPage() {
  return (
    <div className="container mx-auto py-6">
      <NotificationsPageContent />
    </div>
  );
}
