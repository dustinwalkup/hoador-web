import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "How It Works - Payments",
  description: "Documentation for the payment system",
};

export default function HowItWorksPaymentsPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Payments"
        description="How payments, refunds, and payouts work"
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This section will document payment flows, Stripe integration, and
            refund handling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Placeholder for payments documentation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
