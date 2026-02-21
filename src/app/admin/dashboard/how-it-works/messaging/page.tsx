import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  MessageSquare,
  Send,
  Inbox,
  Database,
  FileCode,
  ListChecks,
  Bell,
} from "lucide-react";

export const metadata = {
  title: "How It Works - Messaging",
  description:
    "Bird's-eye view of 1-to-1 conversations, message flow, read/archive, and notifications",
};

const flowSteps = [
  {
    step: 1,
    action: "List conversations",
    apiActor: "GET /api/messages/conversations (authenticated user)",
    result: "Paginated list; optional ?archived=true",
  },
  {
    step: 2,
    action: "Start new conversation",
    apiActor:
      "POST /api/messages/conversations (body: recipientId, listingId, listingName, message)",
    result:
      "Conversation created or found; first message sent; recipient notified",
  },
  {
    step: 3,
    action: "Send message in thread",
    apiActor: "POST /api/messages/conversations/[id]/messages (body: content)",
    result:
      "Message inserted; lastMessageAt updated; recipient gets message_received notification",
  },
  {
    step: 4,
    action: "Mark as read",
    apiActor: "POST /api/messages/conversations/[id]/read",
    result: "user1LastReadAt / user2LastReadAt updated for current user",
  },
  {
    step: 5,
    action: "Archive / Unarchive",
    apiActor: "POST .../archive or .../unarchive",
    result: "user1Archived / user2Archived toggled for current user",
  },
];

const apiRoutes = [
  {
    path: "GET /api/messages/conversations",
    purpose: "List user conversations (query: archived, offset, limit)",
  },
  {
    path: "POST /api/messages/conversations",
    purpose:
      "Start conversation (body: recipientId, listingId, listingName, message)",
  },
  {
    path: "GET /api/messages/conversations/[conversationId]",
    purpose: "Get conversation details (and messages)",
  },
  {
    path: "POST /api/messages/conversations/[conversationId]/messages",
    purpose: "Send message (body: content)",
  },
  {
    path: "POST /api/messages/conversations/[conversationId]/read",
    purpose: "Mark conversation as read",
  },
  {
    path: "POST /api/messages/conversations/[conversationId]/archive",
    purpose: "Archive conversation",
  },
  {
    path: "POST /api/messages/conversations/[conversationId]/unarchive",
    purpose: "Unarchive conversation",
  },
  {
    path: "GET /api/messages/unread-count",
    purpose: "Get total unread count for authenticated user",
  },
];

const keyFiles = [
  { label: "Messages schema", path: "src/db/schemas/messages.schema.ts" },
  { label: "Messages DAL", path: "src/dal/messages.dal.ts" },
  {
    label: "Message received notification",
    path: "src/features/messages/notifications/message-received.ts",
  },
  {
    label: "GET/POST conversations",
    path: "src/app/api/messages/conversations/route.ts",
  },
  {
    label: "POST messages",
    path: "src/app/api/messages/conversations/[conversationId]/messages/route.ts",
  },
  {
    label: "Read",
    path: "src/app/api/messages/conversations/[conversationId]/read/route.ts",
  },
  {
    label: "Archive",
    path: "src/app/api/messages/conversations/[conversationId]/archive/route.ts",
  },
  {
    label: "Unarchive",
    path: "src/app/api/messages/conversations/[conversationId]/unarchive/route.ts",
  },
  {
    label: "Unread count",
    path: "src/app/api/messages/unread-count/route.ts",
  },
  {
    label: "Mailbox UI",
    path: "src/features/messages/components/mailbox-client.tsx",
  },
  {
    label: "Chat area",
    path: "src/features/messages/components/chat-area.tsx",
  },
  {
    label: "Conversations list",
    path: "src/features/messages/components/conversations-list.tsx",
  },
  {
    label: "Hooks: use-conversations",
    path: "src/features/messages/hooks/use-conversations.ts",
  },
  {
    label: "Hooks: use-message-mutations",
    path: "src/features/messages/hooks/use-message-mutations.ts",
  },
  {
    label: "Hooks: use-unread-count",
    path: "src/features/messages/hooks/use-unread-count.ts",
  },
  {
    label: "Start-conversation: message-user-button",
    path: "src/features/messages/components/message-user-button.tsx",
  },
  {
    label: "Start-conversation: message-user-modal",
    path: "src/features/messages/components/message-user-modal.tsx",
  },
];

export default function HowItWorksMessagingPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Messaging"
        description="How conversations and messages work"
      />

      {/* Section 1: System Architecture Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            System Architecture Overview
          </CardTitle>
          <CardDescription>
            1-to-1 conversations, canonical user pair, send flow, and
            read/archive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>1-to-1 only:</strong> Messaging is between two users. A{" "}
              <strong>conversation</strong> is uniquely identified by the pair{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                (user1Id, user2Id)
              </code>{" "}
              with canonical ordering (smaller id = user1Id) — see{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                findOrCreateConversation
              </code>{" "}
              in MessagesDAL (
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/dal/messages.dal.ts
              </code>
              ).
            </li>
            <li>
              <strong>Conversations table</strong> (
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/db/schemas/messages.schema.ts
              </code>
              ): id, user1Id, user2Id, lastMessageAt, per-user user1LastReadAt /
              user2LastReadAt, and per-user archive flags user1Archived /
              user2Archived. Unique constraint on (user1Id, user2Id).
            </li>
            <li>
              <strong>Messages table:</strong> conversationId, senderId, content
              (sanitized), status (sent / delivered / read), optional rentalId
              and listingId for context, editedAt, createdAt.
            </li>
            <li>
              <strong>Sending:</strong> User sends via{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                POST /api/messages/conversations/[id]/messages
              </code>{" "}
              or starts a new thread via{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                POST /api/messages/conversations
              </code>{" "}
              (with recipientId, listingId, listingName, message). DAL
              creates/finds conversation, inserts message, updates
              lastMessageAt; then <strong>message_received</strong> notification
              is sent (in-app, email, push per preferences) — see{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                sendMessageReceivedNotification
              </code>{" "}
              in{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/features/messages/notifications/message-received.ts
              </code>
              .
            </li>
            <li>
              <strong>Read and archive:</strong> Per-user state. Mark read
              updates user1LastReadAt / user2LastReadAt; archive/unarchive
              toggles user1Archived / user2Archived. Unread count is derived
              from messages after last read.
            </li>
          </ol>
          <div className="bg-muted/30 rounded-lg border p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Flow (high level)
            </p>
            <pre className="overflow-x-auto text-xs">
              {`User A starts or opens conversation → sends message
→ conversation created/found, message stored, recipient notified
→ Recipient opens mailbox, marks read; either user can archive`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Conversation and Message Flow (Step Table) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            Conversation and Message Flow (Step Table)
          </CardTitle>
          <CardDescription>
            Main steps from listing conversations to sending and marking read
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Step</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">
                    API / Actor
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {flowSteps.map((row) => (
                  <tr
                    key={row.step}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{row.step}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.apiActor}
                    </td>
                    <td className="px-3 py-2">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            Content is sanitized (e.g.{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              sanitizeMessageContent
            </code>{" "}
            in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/lib/utils/sanitize
            </code>
            ); length limits (e.g. 1–5000 chars) enforced in API schema.
          </p>
        </CardContent>
      </Card>

      {/* Section 3: Data Model (Conversations and Messages) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Data Model (Conversations and Messages)
          </CardTitle>
          <CardDescription>
            conversations and messages tables; message status enum
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>conversations</strong> (
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/db/schemas/messages.schema.ts
            </code>
            ): id, user1Id, user2Id (canonical order), lastMessageAt,
            user1LastReadAt, user2LastReadAt, user1Archived, user2Archived,
            createdAt. Unique on (user1Id, user2Id).
          </p>
          <p>
            <strong>messages:</strong> id, conversationId, senderId, content,
            status (enum: sent, delivered, read), rentalId (optional), listingId
            (optional), editedAt, createdAt.
          </p>
          <p>
            <strong>Message status enum</strong> (
            <code className="bg-muted rounded px-1.5 py-0.5">_enums.ts</code>):
            sent, delivered, read. Read state is typically inferred from
            conversation-level lastReadAt rather than per-message status in the
            UI.
          </p>
        </CardContent>
      </Card>

      {/* Section 4: Notifications (Cross-Link) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Notifications (Cross-Link)
          </CardTitle>
          <CardDescription>
            message_received and link to How It Works - Notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>message_received:</strong> Fired when a message is sent
            (from POST conversations when starting a thread, or POST
            conversations/[id]/messages). Implemented in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              sendMessageReceivedNotification
            </code>{" "}
            (
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/features/messages/notifications/message-received.ts
            </code>
            ); uses central{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              sendNotification
            </code>{" "}
            (in-app + email + push per category &quot;messages&quot;). Link goes
            to{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              /dashboard/mailbox?conversation=&#123;conversationId&#125;
            </code>
            .
          </p>
          <p>
            Cross-reference How It Works - Notifications for channels and
            preference logic.
          </p>
        </CardContent>
      </Card>

      {/* Section 5: API Routes Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5" />
            API Routes Reference
          </CardTitle>
          <CardDescription>
            Messaging-related API routes and their purpose
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">
                    Path / Method
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {apiRoutes.map((row) => (
                  <tr
                    key={row.path}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{row.path}</td>
                    <td className="px-3 py-2">{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            All require authentication via{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              getAuthenticatedUserResponse()
            </code>
            ; participant checks enforced in DAL (user must be user1 or user2 of
            the conversation).
          </p>
        </CardContent>
      </Card>

      {/* Section 6: Key Files Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="size-5" />
            Key Files Reference
          </CardTitle>
          <CardDescription>Main files in the messaging system</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 font-mono text-xs">
            {keyFiles.map((file) => (
              <li key={file.path} className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">{file.label}:</span>
                <code className="bg-muted rounded px-1.5 py-0.5 break-all">
                  {file.path}
                </code>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Section 7: Future Improvements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-5" />
            Future Improvements
          </CardTitle>
          <CardDescription>
            Known future work for the messaging system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <strong>Real-time:</strong> Currently poll or refetch; consider
              WebSockets or Server-Sent Events for live updates.
            </li>
            <li>
              <strong>Message status:</strong> delivered/read lifecycle (e.g.
              mark delivered when recipient opens thread, read when seen).
            </li>
            <li>
              <strong>Edit/delete:</strong> Schema has editedAt; document or
              implement edit/delete message flows.
            </li>
            <li>
              <strong>Attachments / media:</strong> Not in current schema;
              future extension.
            </li>
            <li>
              <strong>Block/report:</strong> User safety features if needed.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
