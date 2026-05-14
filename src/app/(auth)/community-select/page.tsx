import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ReportIssueModal } from "@/components/footer/report-issue-modal";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { AnimatedAuthCard } from "@/features/auth/components/animated-auth-card";
import { CommunitySelectForm } from "@/features/auth/components/community-select-form";

export const metadata: Metadata = {
  title: "Find your community",
};

export default function CommunitySelectPage() {
  return (
    <AuthLayoutWrapper>
      <AnimatedAuthCard delay={100}>
        <Card>
          <CardHeader className="space-y-1 pt-4 text-center">
            <div className="space-y-2 text-center">
              <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                <MapPin className="text-primary h-8 w-8" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Find your community
              </h1>
              <p className="text-muted-foreground text-sm">
                Pick the neighborhood you live in. You can adjust which
                communities you appear in later from your profile.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <CommunitySelectForm />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <div className="text-muted-foreground text-center text-xs">
              Need help?{" "}
              <ReportIssueModal
                triggerClassName="text-primary underline"
                triggerLabel="Contact support"
              />
            </div>
          </CardFooter>
        </Card>
      </AnimatedAuthCard>
    </AuthLayoutWrapper>
  );
}
