import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "How It Works - Authentication",
  description: "Documentation for the authentication system",
};

export default function HowItWorksAuthenticationPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Authentication"
        description="How sign-in, sessions, and authorization work"
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            This section will document the authentication flow, session
            management, and role-based access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Placeholder for authentication documentation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
