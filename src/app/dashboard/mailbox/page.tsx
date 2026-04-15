export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MailboxClient } from "@/features/messages/components/mailbox-client";
import { MailboxSkeleton } from "@/features/messages/components/mailbox-skeleton";
import { messagesDAL } from "@/dal";
import { getAuthenticatedUser } from "@/features/auth/utils/session";

export const metadata = {
  title: "Messages",
  description: "View and manage your messages",
};

export default async function MailboxPage() {
  // Authenticate
  const auth = await getAuthenticatedUser();
  if (!auth) {
    redirect("/sign-in");
  }
  const { userId } = auth;

  const [inboxConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversationsPaginated(userId, false), // inbox
    messagesDAL.getUserConversationsPaginated(userId, true), // archived
  ]);

  // Combine conversations with their archived status
  const allConversations = [...inboxConversations, ...archivedConversations];

  return (
    <Suspense fallback={<MailboxSkeleton />}>
      <MailboxClient conversations={allConversations} />
    </Suspense>
  );
}
