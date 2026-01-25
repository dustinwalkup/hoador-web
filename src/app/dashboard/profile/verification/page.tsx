export const dynamic = "force-dynamic";
import { CheckCircle, AlertCircle } from "lucide-react";
import { userDAL } from "@/dal";
import { ProfileTabs } from "@/features/users/components/profile";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { PROFILE_PAGE_HEADERS } from "@/constants/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Verification",
  description: "Verify your identity and build trust in the community",
};

export default async function VerificationPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <div className="container pb-6">
        <PageHeader
          title={PROFILE_PAGE_HEADERS.verification.title}
          description={PROFILE_PAGE_HEADERS.verification.description}
        />
        <ProfileTabs>
          <Card>
            <CardContent className="pt-6">
              <div className="text-muted-foreground text-center">
                <p>Please log in to view your verification status</p>
              </div>
            </CardContent>
          </Card>
        </ProfileTabs>
      </div>
    );
  }

  const user = await userDAL.getUserById(userId);

  return (
    <div className="container pb-6">
      <PageHeader
        title={PROFILE_PAGE_HEADERS.verification.title}
        description={PROFILE_PAGE_HEADERS.verification.description}
      />

      <ProfileTabs>
        <Card>
          <CardHeader>
            <CardTitle>Account Verification</CardTitle>
            <CardDescription>
              Verify your identity to build trust in the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      user.emailVerified
                        ? "bg-green-100 text-green-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {user.emailVerified ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">Email Verification</h3>
                    <p className="text-muted-foreground text-sm">
                      {user.emailVerified
                        ? "Your email address has been verified"
                        : "Verify your email address to receive important updates"}
                    </p>
                  </div>
                </div>
                {user.emailVerified ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600"
                  >
                    Verified
                  </Badge>
                ) : (
                  <Button size="sm">Verify Now</Button>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"></div>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      user.idVerified
                        ? "bg-green-100 text-green-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {user.idVerified ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">ID Verification</h3>
                    <p className="text-muted-foreground text-sm">
                      {user.idVerified
                        ? "Your identity has been verified"
                        : "Verify your identity with a government-issued ID"}
                    </p>
                  </div>
                </div>
                {user.idVerified ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600"
                  >
                    Verified
                  </Badge>
                ) : (
                  <Button size="sm">Verify Now</Button>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      user.addressVerified
                        ? "bg-green-100 text-green-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {user.addressVerified ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">Address Verification</h3>
                    <p className="text-muted-foreground text-sm">
                      {user.addressVerified
                        ? "Your address has been verified"
                        : "Verify your address to build trust with lenders"}
                    </p>
                  </div>
                </div>
                {user.addressVerified ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-600"
                  >
                    Verified
                  </Badge>
                ) : (
                  <Button size="sm">Verify Now</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </ProfileTabs>
    </div>
  );
}
