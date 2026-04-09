import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { AdminPushTestSection } from "@/features/admin/components/admin-push-test-section";
import { Check, X, Bell, Mail, Smartphone } from "lucide-react";

export const metadata = {
  title: "How It Works - Notifications",
  description:
    "Bird's-eye view of the notification system: triggers, channels, and preferences",
};

const notificationInventory = [
  {
    type: "rental_request_created",
    trigger: "Renter creates request",
    recipient: "Owner",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "rental_approved",
    trigger: "Owner approves",
    recipient: "Renter",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "rental_denied",
    trigger: "Owner declines",
    recipient: "Renter",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "rental_started",
    trigger: "Owner starts rental",
    recipient: "Renter",
    inApp: true,
    email: false,
    push: true,
    status: "active" as const,
  },
  {
    type: "rental_ended",
    trigger: "Owner ends rental",
    recipient: "Renter",
    inApp: true,
    email: false,
    push: true,
    status: "active" as const,
  },
  {
    type: "rental_cancelled",
    trigger: "Renter cancels",
    recipient: "Owner",
    inApp: true,
    email: false,
    push: true,
    status: "active" as const,
  },
  {
    type: "rental_reminder",
    trigger: "Cron job",
    recipient: "Renter",
    inApp: true,
    email: true,
    push: true,
    status: "not_implemented" as const,
  },
  {
    type: "rental_overdue",
    trigger: "—",
    recipient: "—",
    inApp: false,
    email: false,
    push: false,
    status: "not_implemented" as const,
  },
  {
    type: "payment_succeeded",
    trigger: "Payment processes",
    recipient: "Both parties",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "payment_failed",
    trigger: "Payment fails",
    recipient: "Both parties",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "payment_refunded",
    trigger: "—",
    recipient: "—",
    inApp: false,
    email: false,
    push: false,
    status: "not_implemented" as const,
  },
  {
    type: "message_received",
    trigger: "Message sent",
    recipient: "Recipient",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "dispute_created",
    trigger: "Dispute filed",
    recipient: "Other party",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "dispute_evidence_requested",
    trigger: "Admin requests evidence",
    recipient: "Both parties",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "dispute_evidence_deadline_approaching",
    trigger: "—",
    recipient: "—",
    inApp: false,
    email: false,
    push: false,
    status: "not_implemented" as const,
  },
  {
    type: "dispute_evidence_deadline_expired",
    trigger: "—",
    recipient: "—",
    inApp: false,
    email: false,
    push: false,
    status: "not_implemented" as const,
  },
  {
    type: "dispute_resolved",
    trigger: "Admin resolves",
    recipient: "Both parties",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "listing_approved",
    trigger: "Admin approves",
    recipient: "Owner",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "listing_rejected",
    trigger: "Admin rejects",
    recipient: "Owner",
    inApp: true,
    email: true,
    push: true,
    status: "active" as const,
  },
  {
    type: "review_received",
    trigger: "—",
    recipient: "Owner",
    inApp: false,
    email: false,
    push: false,
    status: "not_implemented" as const,
  },
  {
    type: "system (instructions updated)",
    trigger: "Owner updates instructions",
    recipient: "Renter",
    inApp: true,
    email: false,
    push: true,
    status: "active" as const,
  },
];

const keyFiles = [
  {
    label: "Central notification sender",
    path: "src/features/notifications/utils/send-notification.ts",
  },
  {
    label: "Type-to-category mapping",
    path: "src/features/notifications/lib/notification-type-map.ts",
  },
  {
    label: "Preference checking",
    path: "src/features/notifications/lib/preference-service.ts",
  },
  {
    label: "Push sending",
    path: "src/features/notifications/lib/push-service.ts",
  },
  {
    label: "Email sending",
    path: "src/features/notifications/utils/send-email.ts",
  },
  { label: "Notification DAL", path: "src/dal/notifications.dal.ts" },
  {
    label: "Notifications schema",
    path: "src/db/schemas/notifications.schema.ts",
  },
  { label: "Service worker (push)", path: "public/sw.js" },
  { label: "API: notifications", path: "src/app/api/notifications/route.ts" },
  { label: "API: push subscribe", path: "src/app/api/push/subscribe/route.ts" },
  { label: "API: push test", path: "src/app/api/push/test/route.ts" },
  {
    label: "API: preferences",
    path: "src/app/api/notifications/preferences/route.ts",
  },
];

export default function HowItWorksNotificationsPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Notifications"
        description="Bird's-eye view of notification types, channels, and preferences"
      />
      <AdminPushTestSection />

      {/* System Architecture Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>System Architecture Overview</CardTitle>
          <CardDescription>
            How sendNotification() works end-to-end
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>Event occurs</strong> (e.g. rental approved, message
              sent).
            </li>
            <li>
              <strong>Feature-specific function</strong> is called (e.g.{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                sendRentalApprovedNotification
              </code>
              ).
            </li>
            <li>
              <strong>Central sender</strong>{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                sendNotification()
              </code>{" "}
              is invoked with type, title, message, data, and optional email
              payload.
            </li>
            <li>
              <strong>Fan-out:</strong>
              <ul className="mt-1 ml-6 list-disc space-y-0.5">
                <li>
                  <strong>In-app</strong> — Always created in the database and
                  shown in the notification bell.
                </li>
                <li>
                  <strong>Email</strong> — Sent via Resend if the user’s master
                  and category preferences allow it.
                </li>
                <li>
                  <strong>Push</strong> — Sent via Web Push if the user’s master
                  and category preferences allow it (fire-and-forget).
                </li>
              </ul>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Notification Type Inventory */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Type Inventory</CardTitle>
          <CardDescription>
            All notification types, triggers, recipients, and channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Trigger</th>
                  <th className="px-3 py-2 text-left font-medium">Recipient</th>
                  <th
                    className="px-3 py-2 text-center font-medium"
                    title="In-app"
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Bell className="size-3.5" /> In-app
                    </span>
                  </th>
                  <th
                    className="px-3 py-2 text-center font-medium"
                    title="Email"
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Mail className="size-3.5" /> Email
                    </span>
                  </th>
                  <th
                    className="px-3 py-2 text-center font-medium"
                    title="Push"
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Smartphone className="size-3.5" /> Push
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {notificationInventory.map((row) => (
                  <tr
                    key={row.type}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{row.type}</td>
                    <td className="px-3 py-2">{row.trigger}</td>
                    <td className="px-3 py-2">{row.recipient}</td>
                    <td className="px-3 py-2 text-center">
                      {row.inApp ? (
                        <Check className="text-primary mx-auto size-4" />
                      ) : (
                        <X className="text-muted-400 mx-auto size-4" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.email ? (
                        <Check className="text-primary mx-auto size-4" />
                      ) : (
                        <X className="text-muted-400 mx-auto size-4" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.push ? (
                        <Check className="text-primary mx-auto size-4" />
                      ) : (
                        <X className="text-muted-400 mx-auto size-4" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === "active" ? (
                        <Badge variant="default" className="bg-primary">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not implemented</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Preference System */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Preference System</CardTitle>
          <CardDescription>
            How users control which notifications they receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            <strong>Master toggles</strong> (user_preferences):{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              emailNotifications
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              pushNotifications
            </code>
            . If a master is off, no email or push is sent for that channel
            regardless of category.
          </p>
          <p className="text-sm">
            <strong>Category toggles</strong>{" "}
            (notification_category_preferences): bookings, payments, messages,
            disputes, reminders. Each category can be enabled or disabled for
            email and push. If no category preference exists, it defaults to
            enabled.
          </p>
          <p className="text-sm">
            <strong>Logic:</strong> For email or push to be sent, the
            corresponding master must be ON and the notification type’s category
            must be enabled for that channel. In-app notifications are always
            created and are not gated by preferences.
          </p>
        </CardContent>
      </Card>

      {/* Key Files Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Key Files Reference</CardTitle>
          <CardDescription>
            Main files in the notification system
          </CardDescription>
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
    </div>
  );
}
