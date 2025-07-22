import Link from "next/link";
import Image from "next/image";
import { FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { RentalToolInfo } from "@/lib/dal/rentals.dal";

interface RentalToolInfoProps {
  rentalDetails: RentalToolInfo;
}

export function RentalToolInfo({ rentalDetails }: RentalToolInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Tool Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <Image
            src={rentalDetails.toolImageUrl || "/images/placeholder.jpg"}
            alt={rentalDetails.toolName}
            width={150}
            height={150}
            className="rounded-lg object-cover"
          />
          <div className="flex-1">
            <h3 className="mb-2 text-xl font-semibold">
              {rentalDetails.toolName}
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              {rentalDetails.toolBrand && (
                <div>
                  <span className="font-medium">Brand:</span>{" "}
                  {rentalDetails.toolBrand}
                </div>
              )}
              {rentalDetails.toolModel && (
                <div>
                  <span className="font-medium">Model:</span>{" "}
                  {rentalDetails.toolModel}
                </div>
              )}
              {rentalDetails.toolCondition && (
                <div>
                  <span className="font-medium">Condition:</span>
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-green-100 text-green-800 capitalize"
                  >
                    {rentalDetails.toolCondition}
                  </Badge>
                </div>
              )}
            </div>
            <Link href={`/tools/${rentalDetails.toolId}`}>
              <Button variant="outline" size="sm">
                View Full Details
              </Button>
            </Link>
          </div>
        </div>

        {rentalDetails.toolSpecifications &&
          Object.keys(rentalDetails.toolSpecifications).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="mb-3 font-semibold">Specifications</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(rentalDetails.toolSpecifications).map(
                    ([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </>
          )}
      </CardContent>
    </Card>
  );
}
