import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Calendar,
  ArrowRight,
  UserCheck,
  Package,
  Database,
  FileCode,
  ListChecks,
  Bell,
} from "lucide-react";

export const metadata = {
  title: "How It Works - Rentals",
  description:
    "Bird's-eye view of the rental lifecycle: request, approve, start, end, and cancellation",
};

const lifecycleStatuses = [
  {
    status: "pending",
    whoWhen: "Renter creates request",
    nextStates: "approved (owner), denied (owner), cancelled (renter)",
  },
  {
    status: "approved",
    whoWhen: "Owner approves request",
    nextStates: "active (owner starts)",
  },
  {
    status: "active",
    whoWhen: "Owner starts rental",
    nextStates: "completed (owner ends)",
  },
  {
    status: "completed",
    whoWhen: "Owner ends rental",
    nextStates: "— (terminal)",
  },
  {
    status: "denied",
    whoWhen: "Owner declines",
    nextStates: "— (terminal)",
  },
  {
    status: "cancelled",
    whoWhen: "Renter cancels pending",
    nextStates: "— (terminal)",
  },
  {
    status: "overdue",
    whoWhen: "(reserved / future)",
    nextStates: "—",
  },
];

const requestToRentalSteps = [
  {
    step: 1,
    action: "Create request",
    apiActor: "POST /api/rentals (renter)",
    result: "rental_request created, status pending",
  },
  {
    step: 2,
    action: "Approve or decline",
    apiActor: "POST .../approve or .../decline (owner)",
    result: "approved → rental row + charge; denied → status denied",
  },
  {
    step: 3,
    action: "Start rental",
    apiActor: "POST .../start (owner)",
    result: "status active, actualStartDate set",
  },
  {
    step: 4,
    action: "End rental",
    apiActor: "POST .../end (owner)",
    result: "status completed, actualEndDate set",
  },
];

const whoCanDoWhat = [
  {
    action: "Create rental request",
    role: "Renter",
    condition: "Authenticated; listing exists; dates/payment/legal accepted",
  },
  {
    action: "Approve request",
    role: "Owner",
    condition:
      "Request pending; owner has Connect onboarding; payment succeeds",
  },
  {
    action: "Decline request",
    role: "Owner",
    condition: "Request pending; denial reason required",
  },
  {
    action: "Cancel request",
    role: "Renter",
    condition: "Request pending only",
  },
  {
    action: "Start rental",
    role: "Owner",
    condition: "Request approved; on or after start date",
  },
  {
    action: "End rental",
    role: "Owner",
    condition: "Request active",
  },
  {
    action: "Update instructions",
    role: "Owner",
    condition: "Request approved or active",
  },
];

const apiRoutes = [
  { path: "POST /api/rentals", purpose: "Create rental request (renter)" },
  { path: "GET /api/rentals/[id]", purpose: "Get rental/request details" },
  {
    path: "POST /api/rentals/[id]/approve",
    purpose: "Owner approve (charge + create rental)",
  },
  {
    path: "POST /api/rentals/[id]/decline",
    purpose: "Owner decline (body: denialReason)",
  },
  {
    path: "POST /api/rentals/[id]/cancel",
    purpose: "Renter cancel (pending only)",
  },
  {
    path: "POST /api/rentals/[id]/start",
    purpose: "Owner start (approved → active)",
  },
  {
    path: "POST /api/rentals/[id]/end",
    purpose: "Owner end (active → completed)",
  },
  {
    path: "PATCH /api/rentals/[id]/instructions",
    purpose: "Owner update pickup/return instructions",
  },
  {
    path: "GET /api/rentals/renting/requests, .../active, .../completed",
    purpose: "Renter lists",
  },
  {
    path: "GET /api/rentals/lending/incoming, .../active, .../completed",
    purpose: "Owner lists",
  },
];

const keyFiles = [
  { label: "Rentals schema", path: "src/db/schemas/rentals.schema.ts" },
  { label: "Rentals DAL", path: "src/dal/rentals.dal.ts" },
  {
    label: "Create request schema",
    path: "src/features/rentals/lib/form-schema.ts",
  },
  {
    label: "Rent flow (dates, payment, submit)",
    path: "src/features/rentals/components/rent-flow/rent-listing-page-content.tsx",
  },
  { label: "Create request API", path: "src/app/api/rentals/route.ts" },
  {
    label: "Approve",
    path: "src/app/api/rentals/[id]/approve/route.ts",
  },
  {
    label: "Decline",
    path: "src/app/api/rentals/[id]/decline/route.ts",
  },
  {
    label: "Cancel",
    path: "src/app/api/rentals/[id]/cancel/route.ts",
  },
  {
    label: "Start",
    path: "src/app/api/rentals/[id]/start/route.ts",
  },
  {
    label: "End",
    path: "src/app/api/rentals/[id]/end/route.ts",
  },
  {
    label: "Instructions",
    path: "src/app/api/rentals/[id]/instructions/route.ts",
  },
  {
    label: "Notifications",
    path: "src/features/rentals/notifications/",
  },
];

export default function HowItWorksRentalsPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Rentals"
        description="How rental requests, approvals, and lifecycle work"
      />

      {/* Section 1: System Architecture Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            System Architecture Overview
          </CardTitle>
          <CardDescription>
            Two main tables, renter and owner flows, and where state lives
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>Two main tables:</strong>{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                rental_requests
              </code>{" "}
              holds every request (pending, approved, denied, active, completed,
              cancelled, overdue). When the owner <strong>approves</strong>, a
              row is created in <strong>rentals</strong> (one-to-one with the
              approved request via{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">request_id</code>
              ). All lifecycle state lives on{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                rental_requests.status
              </code>
              .
            </li>
            <li>
              <strong>Renter flow:</strong> Renter picks dates and payment
              method in the rent flow, submits via{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                POST /api/rentals
              </code>
              ; request is created with status{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">pending</code>.
              No charge yet — payment is taken when the owner approves.
            </li>
            <li>
              <strong>Owner flow:</strong> Owner sees incoming requests; can{" "}
              <strong>approve</strong> (charge + create rental + authorize
              deposit), <strong>decline</strong> (with reason), or ignore. For
              approved rentals, owner <strong>starts</strong> the rental
              (approved → active) and <strong>ends</strong> it (active →
              completed). Owner can update{" "}
              <strong>pickup/return instructions</strong> (approved/active).
            </li>
            <li>
              <strong>Cancellation:</strong> Only the <strong>renter</strong>{" "}
              can cancel, and only while the request is still{" "}
              <strong>pending</strong>.
            </li>
            <li>
              <strong>Notifications:</strong> Each transition triggers
              notifications (request created, approved, denied, cancelled,
              started, ended, instructions updated, payment succeeded/failed) —
              see How It Works - Notifications.
            </li>
          </ol>
          <div className="bg-muted/30 rounded-lg border p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Flow (high level)
            </p>
            <pre className="overflow-x-auto text-xs">
              {`Renter creates request (pending) → Owner approves (approved + rental row)
or declines (denied) or Renter cancels (cancelled) → Owner starts (active)
→ Owner ends (completed)`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Rental Lifecycle (Status Flow) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Rental Lifecycle (Status Flow)
          </CardTitle>
          <CardDescription>
            Statuses and how to get there; terminal states
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Who / When
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    Next possible states
                  </th>
                </tr>
              </thead>
              <tbody>
                {lifecycleStatuses.map((row) => (
                  <tr
                    key={row.status}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{row.whoWhen}</td>
                    <td className="px-3 py-2">{row.nextStates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            <code className="bg-muted rounded px-1.5 py-0.5">
              rental_requests
            </code>{" "}
            stores status; when status is approved, active, or completed, a
            corresponding <strong>rentals</strong> row exists. Owner-only
            actions: approve, decline, start, end, update instructions.
            Renter-only: create request, cancel (pending only).
          </p>
        </CardContent>
      </Card>

      {/* Section 3: Request-to-Rental Flow */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="size-5" />
            Request-to-Rental Flow (Step Table)
          </CardTitle>
          <CardDescription>
            Main steps from create request to completed rental
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                {requestToRentalSteps.map((row) => (
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
          <p className="text-muted-foreground mt-3 text-sm">
            Renter can cancel (POST .../cancel) before step 2. Owner can PATCH
            .../instructions for approved/active rentals.
          </p>
        </CardContent>
      </Card>

      {/* Section 4: Who Can Do What (Authorization) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="size-5" />
            Who Can Do What (Authorization)
          </CardTitle>
          <CardDescription>
            Allowed role and conditions for each action
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Allowed role
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Condition</th>
                </tr>
              </thead>
              <tbody>
                {whoCanDoWhat.map((row) => (
                  <tr
                    key={row.action}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">{row.role}</td>
                    <td className="px-3 py-2">{row.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            API routes use{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              getRentalRequestById(rentalId, currentUserId)
            </code>{" "}
            and then check{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">ownerId</code> or{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">renterId</code> vs{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              currentUserId
            </code>{" "}
            (see approve, decline, cancel, start, end routes).
          </p>
        </CardContent>
      </Card>

      {/* Section 5: Data Model (Rental Requests vs Rentals) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Data Model (Rental Requests vs Rentals)
          </CardTitle>
          <CardDescription>
            rental_requests, rentals, and reviews tables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>rental_requests</strong> (
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/db/schemas/rentals.schema.ts
            </code>
            ): listingId, renterId, ownerId, startDate, endDate, totalDays,
            dailyRate, totalAmount, securityDeposit, delivery/setup flags and
            fees, message, paymentMethodId, paymentStatus,
            securityDepositAuthId, <strong>status</strong>, approvedAt,
            deniedAt, denialReason, etc.
          </p>
          <p>
            <strong>rentals:</strong> Created on approve; links via requestId;
            stores actualStartDate, actualEndDate, pickupInstructions,
            returnInstructions, condition/damage fields, rentalPaymentIntentId,
            applicationFeeAmount, etc. No separate status column — lifecycle is
            on the request.
          </p>
          <p>
            <strong>reviews:</strong> Post-rental reviews linked to rentalId
            (renter/owner, rating, comment, etc.).
          </p>
        </CardContent>
      </Card>

      {/* Section 6: Rental Notifications (Cross-Link) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Rental Notifications (Cross-Link)
          </CardTitle>
          <CardDescription>
            Notification types triggered by rental lifecycle events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Rental-related notification types: rental_request_created,
            rental_approved, rental_denied, rental_cancelled, rental_started,
            rental_ended, payment_succeeded, payment_failed, system
            (instructions updated).
          </p>
          <p>
            Delivery is implemented in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/features/rentals/notifications/
            </code>{" "}
            (e.g. rental-approved.ts, rental-denied.ts, rental-started.ts,
            rental-ended.ts, instructions-updated.ts).
          </p>
        </CardContent>
      </Card>

      {/* Section 7: API Routes Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5" />
            API Routes Reference
          </CardTitle>
          <CardDescription>
            Rental-related API routes and their purpose
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
        </CardContent>
      </Card>

      {/* Section 8: Key Files Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="size-5" />
            Key Files Reference
          </CardTitle>
          <CardDescription>Main files in the rental system</CardDescription>
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

      {/* Section 9: Future Improvements */}
      <Card>
        <CardHeader>
          <CardTitle>Future Improvements</CardTitle>
          <CardDescription>
            Known future work for the rental system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <strong>Overdue:</strong>{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">overdue</code>{" "}
              status exists in enum; document or implement cron/job that sets it
              when end date is passed without owner ending.
            </li>
            <li>
              <strong>Extensions:</strong> Schema has extensionRequested,
              extensionApproved; document or implement extension flow.
            </li>
            <li>
              <strong>Reviews:</strong> Reviews table and review flow; link to
              review UX when present.
            </li>
            <li>
              <strong>Disputes:</strong> Link to dispute flow for
              damage/non-return (if documented elsewhere).
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
