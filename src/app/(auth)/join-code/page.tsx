import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ReportIssueModal } from "@/components/footer/report-issue-modal";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { AnimatedAuthCard } from "@/features/auth/components/animated-auth-card";
import { JoinCodeForm } from "@/features/auth/components/join-code-form";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Join Community",
};

export default function JoinCodePage() {
  return (
    <AuthLayoutWrapper>
      <AnimatedAuthCard delay={100}>
        <Card>
          <CardHeader className="space-y-1 pt-4 text-center">
            <div className="space-y-2 text-center">
              <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                <Users className="text-primary h-8 w-8" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Join your community
              </h1>
              <p className="text-muted-foreground text-sm">
                Enter the join code provided by your community administrator
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <JoinCodeForm />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <div className="text-muted-foreground text-center text-xs">
              Need help? Contact your community administrator or{" "}
              <ReportIssueModal>
                <button className="text-primary underline">support</button>
              </ReportIssueModal>
            </div>
          </CardFooter>
        </Card>
      </AnimatedAuthCard>
    </AuthLayoutWrapper>
  );
}
