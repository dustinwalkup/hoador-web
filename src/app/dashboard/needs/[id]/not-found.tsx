import Link from "next/link";
import { HandHelping, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NeedNotFound() {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card className="text-center">
        <CardHeader>
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <HandHelping className="text-muted-foreground h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Need not available</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Neutral copy on purpose: this page also serves out-of-network
              needs, so it must not reveal whether the need exists. */}
          <p className="text-muted-foreground">
            This neighborhood need doesn&apos;t exist or is no longer available.
          </p>
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard/needs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Neighborhood Needs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
