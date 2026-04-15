export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MailboxClient } from "@/features/messages/components/mailbox-client";
import { MailboxSkeleton } from "@/features/messages/components/mailbox-skeleton";
import { messagesDAL } from "@/dal";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { getServerQueryClient, HydrateClient } from "@/lib/react-query/server";

export const metadata = {
  title: "Messages",
  description: "View and manage your messages",
};

export default async function MailboxPage() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    redirect("/sign-in");
  }
  const { userId } = auth;

  const qc = getServerQueryClient();

  const [inboxConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversationsPaginated(userId, false),
    messagesDAL.getUserConversationsPaginated(userId, true),
  ]);

  qc.setQueryData(["conversations", false], {
    pages: [inboxConversations],
    pageParams: [0],
  });
  qc.setQueryData(["conversations", true], {
    pages: [archivedConversations],
    pageParams: [0],
  });

  const allConversations = [...inboxConversations, ...archivedConversations];

  return (
    <Suspense fallback={<MailboxSkeleton />}>
      <HydrateClient>
        <MailboxClient conversations={allConversations} />
      </HydrateClient>
    </Suspense>
  );
}
