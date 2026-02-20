import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "How It Works - Messaging",
  description: "Documentation for the messaging system",
};

export default function HowItWorksMessagingPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Messaging"
        description="How conversations and messages work"
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This section will document conversation threads, message delivery,
            and related notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Placeholder for messaging documentation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
