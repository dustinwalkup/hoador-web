import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  CreditCard,
  Wallet,
  Building2,
  ArrowRightLeft,
  Shield,
  ShieldAlert,
  Database,
  FileCode,
  ListChecks,
} from "lucide-react";
import { HowPaymentsWorkModal } from "@/components/payments/how-payments-work-modal";

export const metadata = {
  title: "How It Works - Payments",
  description:
    "Bird's-eye view of renters paying, storing cards, Stripe Connect, and payouts",
};

const renterFlowSteps = [
  {
    step: 1,
    where: "Rent flow → Payment step",
    what: "Setup Intent created (POST /api/(payments)/create-setup-intent); Stripe Customer created if needed; card saved with usage: off_session.",
  },
  {
    step: 2,
    where: "Rent flow → Summary",
    what: "paymentMethodId sent with request; stored on rental_requests.payment_method_id. No charge yet.",
  },
  {
    step: 3,
    where: "Owner dashboard",
    what: "Approve route charges rental amount (destination charge) and authorizes security deposit (hold). One payments row created.",
  },
];

const sellerConnectSteps = [
  {
    step: "Create account",
    what: "UserDAL.getOrCreateConnectedAccount(userId) → createConnectedAccount (Express, US, metadata.userId).",
  },
  {
    step: "Onboarding",
    what: "Frontend gets account session (POST /api/stripe/create-account-session, default = onboarding) → embedded Connect components.",
  },
  {
    step: "Status sync",
    what: "Webhook account.updated → updateConnectOnboardingStatus (chargesEnabled, payoutsEnabled). connect_onboarding_complete = true when both true.",
  },
  {
    step: "Approving rentals",
    what: "Owner must have completed Connect onboarding; isConnectOnboardingComplete checked in approve route.",
  },
];

const apiRoutes = [
  {
    path: "POST /api/(payments)/create-setup-intent",
    purpose: "Setup Intent + create customer if needed",
  },
  {
    path: "GET /api/(payments)/get-payment-methods",
    purpose: "List renter\u2019s cards (Stripe)",
  },
  {
    path: "POST /api/stripe/attach-payment-method",
    purpose: "Attach payment method to customer",
  },
  {
    path: "DELETE /api/stripe/delete-payment-method",
    purpose: "Detach (query id)",
  },
  {
    path: "POST /api/stripe/set-default-payment-method",
    purpose: "Set default",
  },
  {
    path: "POST /api/stripe/create-customer-portal-session",
    purpose: "Billing portal URL",
  },
  {
    path: "POST /api/stripe/create-account-session",
    purpose: "Connect session (onboarding or mode=payments)",
  },
  {
    path: "POST /api/stripe/update-onboarding-status",
    purpose: "Refresh Connect flags",
  },
  {
    path: "POST /api/stripe/create-login-link",
    purpose: "Express Dashboard link",
  },
  {
    path: "POST /api/stripe/webhooks",
    purpose: "account.updated, account.closed",
  },
  {
    path: "POST /api/rentals/[id]/approve",
    purpose: "Approve rental, charge, authorize deposit, create payment record",
  },
  {
    path: "POST /api/disputes",
    purpose: "Create dispute (renter or provider)",
  },
  { path: "GET /api/disputes/[id]", purpose: "Get dispute by ID" },
  {
    path: "PATCH /api/disputes/[id]/state",
    purpose: "Admin state transition (evidence_requested, under_review, etc.)",
  },
  {
    path: "POST /api/disputes/[id]/resolve",
    purpose: "Admin resolve with outcome and financial operations",
  },
  {
    path: "POST /api/disputes/[id]/evidence",
    purpose: "Upload dispute evidence",
  },
  { path: "GET /api/disputes/[id]/audit", purpose: "Dispute audit log" },
  { path: "POST /api/disputes/[id]/notes", purpose: "Admin internal notes" },
];

const keyFiles = [
  { label: "Stripe server instance", path: "src/services/stripe/server.ts" },
  {
    label: "Rental charges and deposit",
    path: "src/services/stripe/rental-payments.ts",
  },
  {
    label: "Connect (accounts, sessions)",
    path: "src/services/stripe/connect.ts",
  },
  { label: "Payment constants", path: "src/constants/payments.ts" },
  { label: "Payment DAL", path: "src/dal/payment.dal.ts" },
  {
    label: "User DAL (Stripe customer + Connect)",
    path: "src/dal/user.dal.ts",
  },
  { label: "Payments schema", path: "src/db/schemas/payments.schema.ts" },
  {
    label: "User schema (Stripe fields)",
    path: "src/db/schemas/user.schema.ts",
  },
  {
    label: "Create Setup Intent",
    path: "src/app/api/(payments)/create-setup-intent/route.ts",
  },
  {
    label: "Get payment methods",
    path: "src/app/api/(payments)/get-payment-methods/route.ts",
  },
  {
    label: "Approve rental (charge)",
    path: "src/app/api/rentals/[id]/approve/route.ts",
  },
  {
    label: "Create account session",
    path: "src/app/api/stripe/create-account-session/route.ts",
  },
  {
    label: "Stripe webhooks",
    path: "src/app/api/stripe/webhooks/route.ts",
  },
  {
    label: "Rent flow (payment step)",
    path: "src/features/rentals/components/rent-flow/rent-listing-page-content.tsx",
  },
  {
    label: "Earnings and Payouts UI",
    path: "src/features/payments/components/earnings-and-payouts-page-client.tsx",
  },
  { label: "Dispute DAL", path: "src/dal/dispute.dal.ts" },
  { label: "Disputes schema", path: "src/db/schemas/disputes.schema.ts" },
  {
    label: "Dispute financial service",
    path: "src/services/stripe/dispute-financial.ts",
  },
  {
    label: "Resolve dispute route",
    path: "src/app/api/disputes/[id]/resolve/route.ts",
  },
  {
    label: "Dispute state machine",
    path: "src/features/disputes/lib/state-machine.ts",
  },
  {
    label: "Admin resolution panel",
    path: "src/features/disputes/components/admin-resolution-panel.tsx",
  },
];

const disputeFinancialOperationsTable = [
  {
    operation: "refund_full / refund_partial",
    stripeEffect:
      "Stripe refund created on rental PaymentIntent (refunds.create).",
    dbEffect:
      "Row in dispute_financial_operations. payments row is NOT updated (refundedAt, refundAmount, status stay unchanged).",
  },
  {
    operation: "hold_payout",
    stripeEffect: "None.",
    dbEffect:
      "Row in dispute_financial_operations only. Not enforced — Stripe still pays out to connected account; no app or Stripe hold.",
  },
  {
    operation: "capture_deposit",
    stripeEffect:
      "Security deposit PaymentIntent captured (captureSecurityDeposit).",
    dbEffect: "Row in dispute_financial_operations with stripeOperationId.",
  },
];

export default function HowItWorksPaymentsPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Payments"
        description="How payments, refunds, and payouts work"
      />

      {/* User-facing payments explainer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            User-Facing Payments Explainer
          </CardTitle>
          <CardDescription>
            The modal users see when they click &quot;Learn how payments
            work&quot; throughout the app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HowPaymentsWorkModal className="text-sm" />
        </CardContent>
      </Card>

      {/* Section 1: System Architecture Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            System Architecture Overview
          </CardTitle>
          <CardDescription>
            How Stripe, renters, owners, and payouts fit together
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>Stripe</strong> is the payment provider (server instance
              in{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/services/stripe/server.ts
              </code>
              ).
            </li>
            <li>
              <strong>Renters</strong> have a <strong>Stripe Customer</strong>{" "}
              per user (
              <code className="bg-muted rounded px-1.5 py-0.5">
                user.stripe_customer_id
              </code>
              ); cards are saved via <strong>Setup Intent</strong> (off-session)
              and attached to that customer. No payment at request time — renter
              submits request with{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                paymentMethodId
              </code>{" "}
              stored on{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                rental_requests.payment_method_id
              </code>
              .
            </li>
            <li>
              <strong>Owners/sellers</strong> use{" "}
              <strong>Stripe Connect Express</strong> — one connected account
              per user (
              <code className="bg-muted rounded px-1.5 py-0.5">
                user.stripe_connected_account_id
              </code>
              ). Onboarding via embedded Connect components and account session;{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                account.updated
              </code>{" "}
              webhook keeps{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                connect_charges_enabled
              </code>{" "}
              /{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                connect_payouts_enabled
              </code>{" "}
              in sync.
            </li>
            <li>
              <strong>Charge flow:</strong> When owner approves (
              <code className="bg-muted rounded px-1.5 py-0.5">
                POST /api/rentals/[id]/approve
              </code>
              ), the app charges the {"renter's"} saved card with a{" "}
              <strong>destination charge</strong> to the {"owner's"} connected
              account; platform takes an <strong>application fee</strong> (
              <code className="bg-muted rounded px-1.5 py-0.5">
                PLATFORM_FEE_PERCENTAGE
              </code>{" "}
              = 10% in{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/constants/payments.ts
              </code>
              ). Security deposit is <strong>authorized (hold)</strong> only;
              capture/release in disputes or end-of-rental.
            </li>
            <li>
              <strong>Payouts:</strong> No app-side transfer logic. Funds land
              in the connected account via destination charges; Stripe pays out
              to the {"seller's"} bank per Connect schedule. Sellers view
              earnings/payouts in the <strong>Earnings and Payouts</strong> tab
              using Stripe Connect embedded components (
              <code className="bg-muted rounded px-1.5 py-0.5">
                mode=payments
              </code>
              ).
            </li>
          </ol>
          <div className="bg-muted/30 rounded-lg border p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Flow (high level)
            </p>
            <pre className="overflow-x-auto text-xs">
              {`Renter: Setup Intent → save card → submit request
       → Owner approves → Charge (destination) + Deposit (authorize)
       → Owner connected account → Stripe payouts to bank`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Renter Flow (Paying and Storing Cards) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Renter Flow (Paying and Storing Cards)
          </CardTitle>
          <CardDescription>
            Steps from adding a card to payment on approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Step</th>
                  <th className="px-3 py-2 text-left font-medium">Where</th>
                  <th className="px-3 py-2 text-left font-medium">
                    What happens
                  </th>
                </tr>
              </thead>
              <tbody>
                {renterFlowSteps.map((row) => (
                  <tr
                    key={row.step}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{row.step}</td>
                    <td className="px-3 py-2">{row.where}</td>
                    <td className="px-3 py-2">{row.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            Cards live on <strong>Stripe</strong> (customer); optional mirror in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              user_payment_methods
            </code>{" "}
            for display. List/attach/delete/default via get-payment-methods,
            attach-payment-method, delete-payment-method,
            set-default-payment-method. Customer Portal available via
            create-customer-portal-session.
          </p>
        </CardContent>
      </Card>

      {/* Section 3: Storing Cards and Payment Methods */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Storing Cards and Payment Methods
          </CardTitle>
          <CardDescription>
            Where payment methods live and how the customer is created
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Stripe (source of truth):</strong> One Stripe Customer per
            user; payment methods attached via Stripe API; default set on{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              customers.update
            </code>{" "}
            (
            <code className="bg-muted rounded px-1.5 py-0.5">
              invoice_settings.default_payment_method
            </code>
            ).
          </p>
          <p>
            <strong>App DB:</strong>{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              user.stripe_customer_id
            </code>
            ;{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              user_payment_methods
            </code>{" "}
            table (stripe_payment_method_id, last4, brand, expiry, is_primary,
            is_active) for display.
          </p>
          <p>
            <strong>Create customer:</strong> When first Setup Intent is created
            or when first needed in approve flow —{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              UserDAL.getOrCreateStripeCustomerId
            </code>
            .
          </p>
        </CardContent>
      </Card>

      {/* Section 4: Sellers — Stripe Connect */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Sellers — Stripe Connect (Platform Accounts and Onboarding)
          </CardTitle>
          <CardDescription>
            How connected accounts are created and onboarding status is synced
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Step</th>
                  <th className="px-3 py-2 text-left font-medium">
                    What happens
                  </th>
                </tr>
              </thead>
              <tbody>
                {sellerConnectSteps.map((row) => (
                  <tr
                    key={row.step}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{row.step}</td>
                    <td className="px-3 py-2">{row.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            User schema fields:{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              stripe_connected_account_id
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              connect_onboarding_complete
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              connect_charges_enabled
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              connect_payouts_enabled
            </code>
            . Manual refresh:{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              POST /api/stripe/update-onboarding-status
            </code>
            . Express Dashboard link:{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              POST /api/stripe/create-login-link
            </code>
            .
          </p>
        </CardContent>
      </Card>

      {/* Section 5: Charges and Destination Charges */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5" />
            Charges and Destination Charges
          </CardTitle>
          <CardDescription>
            Rental charge, security deposit hold, and platform fee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Rental charge:</strong>{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              chargeRentalPayment
            </code>{" "}
            in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/services/stripe/rental-payments.ts
            </code>{" "}
            (approve flow): PaymentIntent with customer, payment_method,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              off_session: true
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              confirm: true
            </code>
            ; when ownerConnectedAccountId provided, transfer_data.destination
            and application_fee_amount (platform fee %).
          </p>
          <p>
            <strong>Security deposit:</strong>{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              authorizeSecurityDeposit
            </code>{" "}
            — PaymentIntent with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              {'capture_method: "manual"'}
            </code>{" "}
            (hold only). Capture/release via captureSecurityDeposit /
            releaseSecurityDeposit (e.g. disputes).
          </p>
          <p>
            <strong>Platform fee:</strong> From{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/constants/payments.ts
            </code>{" "}
            (
            <code className="bg-muted rounded px-1.5 py-0.5">
              PLATFORM_FEE_PERCENTAGE
            </code>
            ); applied as application_fee_amount on destination charge.
          </p>
        </CardContent>
      </Card>

      {/* Section 6: Payouts to Sellers */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            Payouts to Sellers
          </CardTitle>
          <CardDescription>
            How funds reach sellers and where they view earnings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>No app-side transfers.</strong> Funds reach the connected
            account via <strong>destination charges</strong>; Stripe handles
            payouts from the connected account to the {"seller's"} bank.
          </p>
          <p>
            <strong>Earnings and Payouts UI:</strong> Sellers use Stripe Connect
            embedded components (balances, payouts list, payments) with account
            session created with{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              mode=payments
            </code>{" "}
            ( create-account-session with components: balances, payouts,
            payouts_list, payments). Implemented in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              earnings-and-payouts-page-client.tsx
            </code>
            .
          </p>
        </CardContent>
      </Card>

      {/* Section 7: Payment Records and Database */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            Payment Records and Database
          </CardTitle>
          <CardDescription>
            payments table, PaymentDAL, and status enum
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>payments table</strong> (
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/db/schemas/payments.schema.ts
            </code>
            ): rentalId, payerId, payeeId, amount, platformFee, paymentMethodId,
            stripePaymentIntentId, status, paidAt, refundedAt, refundAmount,
            refundReason.
          </p>
          <p>
            <strong>PaymentDAL</strong> (
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/dal/payment.dal.ts
            </code>
            ):{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              getUserRentalPayments(userId)
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              getByRentalId(rentalId)
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              createPayment(data)
            </code>
            .
          </p>
          <p>
            <strong>Status enum:</strong> payment_status in _enums.ts (pending,
            processing, succeeded, completed, failed, refunded).
          </p>
        </CardContent>
      </Card>

      {/* Section: Disputes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            Disputes
          </CardTitle>
          <CardDescription>
            Current implementation and payment effects of dispute resolution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Current implementation</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>
                <strong>In-app disputes only:</strong> Disputes are created via
                the app (renter or provider), not from Stripe cardholder
                chargebacks. Schema has{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  stripeChargebackId
                </code>{" "}
                on disputes but it is never set; webhooks handle only{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  account.updated
                </code>{" "}
                /{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  account.closed
                </code>{" "}
                — no{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  charge.dispute.*
                </code>
                .
              </li>
              <li>
                <strong>Lifecycle:</strong> One dispute per rental;{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  POST /api/disputes
                </code>{" "}
                ; state machine: open → evidence_requested → under_review →
                resolved → closed. Rate limits (3/month, 10/year), time windows
                by reason code, evidence deadlines; admin-only resolution.
              </li>
              <li>
                <strong>Resolution:</strong>{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  POST /api/disputes/[id]/resolve
                </code>{" "}
                (admin) accepts outcome, reason, and optional
                financialOperations; StripeDisputeService runs ops in order,
                then dispute marked resolved.
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">
              Payment effects (financial operations)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium">
                      Operation
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Stripe effect
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      DB / audit effect
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {disputeFinancialOperationsTable.map((row) => (
                    <tr
                      key={row.operation}
                      className="hover:bg-muted/30 border-b last:border-0"
                    >
                      <td className="px-3 py-2 font-medium">{row.operation}</td>
                      <td className="px-3 py-2">{row.stripeEffect}</td>
                      <td className="px-3 py-2">{row.dbEffect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Refunds do not update the{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">payments</code>{" "}
              table. Hold payout is audit-only and not enforced.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section: Disputes — Gaps and improvement checklist */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            Disputes: Gaps and Improvement Checklist
          </CardTitle>
          <CardDescription>
            Scenarios the code does not handle that users could realistically
            trigger, and future work
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-3 text-sm">
            <li>
              <strong>Payments table out of sync</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: After a dispute refund, payments.refundedAt,
                  refundAmount, refundReason, status are never updated.
                </li>
                <li>
                  Improvement: After successful refund in
                  StripeDisputeService.createRefund, update payment row (e.g.
                  PaymentDAL.updateRefund()).
                </li>
              </ul>
            </li>
            <li>
              <strong>Double refund / over-refund</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: No check that payment has not already been fully refunded
                  or that sum of partial refunds does not exceed payment amount.
                </li>
                <li>
                  Improvement: Before creating a refund, check existing
                  dispute_financial_operations and total refunded vs payment
                  amount; reject or cap.
                </li>
              </ul>
            </li>
            <li>
              <strong>Stripe cardholder chargebacks</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: If customer disputes with their bank, Stripe emits
                  charge.dispute.created; app does not handle;
                  disputes.stripeChargebackId never set.
                </li>
                <li>
                  Improvement: Handle Stripe dispute webhooks; create or link
                  internal dispute and set stripeChargebackId; consider
                  auto-hold or alerts.
                </li>
              </ul>
            </li>
            <li>
              <strong>Hold payout not enforced</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: &quot;Hold payout&quot; only creates an audit record;
                  Stripe still pays out to connected account.
                </li>
                <li>
                  Improvement: Document as policy/audit-only until Stripe
                  Reserve or manual process exists; or implement actual hold.
                </li>
              </ul>
            </li>
            <li>
              <strong>Application fee on refunds</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: For destination charges, platform takes application fee;
                  Stripe refund behavior on fee/transfer reversal should be
                  confirmed.
                </li>
                <li>
                  Improvement: Verify Stripe refund behavior for destination
                  charges; add transfer reversal if needed.
                </li>
              </ul>
            </li>
            <li>
              <strong>Idempotency</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: Resolve endpoint and financial operations have no
                  idempotency key; duplicate submissions could run ops twice.
                </li>
                <li>
                  Improvement: Idempotency keys on POST
                  /api/disputes/[id]/resolve and/or idempotent checks in
                  executeOperation.
                </li>
              </ul>
            </li>
            <li>
              <strong>Release deposit</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: releaseSecurityDeposit exists in rental-payments but no
                  financial operation type for &quot;release deposit&quot; in
                  disputes (only capture_deposit).
                </li>
                <li>
                  Improvement: Add release_deposit operation type and wire in
                  resolve flow if product requires it.
                </li>
              </ul>
            </li>
            <li>
              <strong>Webhook sync</strong>
              <ul className="text-muted-foreground ml-4 list-disc">
                <li>
                  Gap: No handling of charge.refunded / payment_intent.refunded
                  to sync payments status when refund is created outside app.
                </li>
                <li>
                  Improvement: Optional webhook handler to update payments when
                  Stripe reports a refund.
                </li>
              </ul>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Section 8: API Routes Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5" />
            API Routes Reference
          </CardTitle>
          <CardDescription>
            Payment-related API routes and their purpose
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

      {/* Section 9: Key Files Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="size-5" />
            Key Files Reference
          </CardTitle>
          <CardDescription>Main files in the payment system</CardDescription>
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

      {/* Section 10: Future Improvements */}
      <Card>
        <CardHeader>
          <CardTitle>Future Improvements</CardTitle>
          <CardDescription>
            Known future work for the payment system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              Refund flow documentation / UI (refund fields exist on payments;
              dispute financial operations in{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/services/stripe/dispute-financial.ts
              </code>
              ).
            </li>
            <li>
              Webhook handling for payment_intent.succeeded /
              payment_intent.payment_failed if needed for idempotency or
              notifications.
            </li>
            <li>Rate limiting / idempotency keys on payment endpoints.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
