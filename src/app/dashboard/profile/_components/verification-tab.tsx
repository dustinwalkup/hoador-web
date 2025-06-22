import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function VerificationTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Verification</CardTitle>
        <CardDescription>
          Verify your identity to build trust in the community
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">Email Verification</h3>
                <p className="text-muted-foreground text-sm">
                  Your email address has been verified
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-600">
              Verified
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">Phone Verification</h3>
                <p className="text-muted-foreground text-sm">
                  Your phone number has been verified
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-600">
              Verified
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">ID Verification</h3>
                <p className="text-muted-foreground text-sm">
                  Upload a government-issued ID to verify your identity
                </p>
              </div>
            </div>
            <Button size="sm">Verify Now</Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">Address Verification</h3>
                <p className="text-muted-foreground text-sm">
                  Verify your address to build trust with lenders
                </p>
              </div>
            </div>
            <Button size="sm">Verify Now</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
