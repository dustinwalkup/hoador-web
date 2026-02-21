import Link from "next/link";
import Image from "next/image";
import { FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { RentalListingInfo } from "@/dal/rentals.dal";

interface RentalListingInfoProps {
  rentalDetails: RentalListingInfo;
}

export function RentalListingInfo({ rentalDetails }: RentalListingInfoProps) {
  return (
    <Card className="border bg-transparent shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Listing Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <div className="relative aspect-4/3 w-24 shrink-0 overflow-hidden rounded-lg sm:w-32">
            <Image
              src={rentalDetails.listingImageUrl || "/images/placeholder.jpg"}
              alt={rentalDetails.listingName}
              fill
              sizes="128px"
              className="rounded-lg object-contain"
            />
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-xl font-semibold">
              {rentalDetails.listingName}
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              {rentalDetails.listingBrand && (
                <div>
                  <span className="font-medium">Brand:</span>{" "}
                  {rentalDetails.listingBrand}
                </div>
              )}
              {rentalDetails.listingModel && (
                <div>
                  <span className="font-medium">Model:</span>{" "}
                  {rentalDetails.listingModel}
                </div>
              )}
              {rentalDetails.listingCondition && (
                <div>
                  <span className="font-medium">Condition:</span>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary ml-2 capitalize"
                  >
                    {rentalDetails.listingCondition}
                  </Badge>
                </div>
              )}
            </div>
            <Link href={`/dashboard/listings/${rentalDetails.listingId}`}>
              <Button variant="outline" size="sm">
                View Full Details
              </Button>
            </Link>
          </div>
        </div>

        {rentalDetails.listingSpecifications &&
          Object.keys(rentalDetails.listingSpecifications).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="mb-3 font-semibold">Specifications</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(rentalDetails.listingSpecifications).map(
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
