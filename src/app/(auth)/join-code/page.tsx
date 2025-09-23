import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { JoinCodeForm } from "@/features/auth/components/join-code-form";
import { Users } from "lucide-react";

export default function JoinCodePage() {
  return (
    <AuthLayoutWrapper>
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
      </Card>
    </AuthLayoutWrapper>
  );
}
