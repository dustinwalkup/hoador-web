import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "How It Works - Rentals",
  description: "Documentation for the rental lifecycle",
};

export default function HowItWorksRentalsPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Rentals"
        description="How rental requests, approvals, and lifecycle work"
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This section will document the rental flow from request to start,
            end, and cancellation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Placeholder for rentals documentation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
