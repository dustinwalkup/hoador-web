import {
  Calendar,
  MapPin,
  Truck,
  Clock,
  Wrench,
  ExternalLink,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RentalDetailsInfo } from "@/dal/rentals.dal";

interface RentalDetailsCardProps {
  rentalDetails: RentalDetailsInfo;
}

export function RentalDetailsCard({ rentalDetails }: RentalDetailsCardProps) {
  const deliveryTotal = parseFloat(rentalDetails.deliveryFee);
  const setupTotal = parseFloat(rentalDetails.setupFee || "0");
  const securityDeposit = parseFloat(rentalDetails.securityDeposit);
  const totalAmount = parseFloat(rentalDetails.totalAmount);
  const grandTotal = totalAmount + deliveryTotal + setupTotal + securityDeposit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Rental Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-3 font-semibold">Rental Period</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Start Date:</span>
                <span className="font-medium">
                  {new Date(rentalDetails.startDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>End Date:</span>
                <span className="font-medium">
                  {new Date(rentalDetails.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">
                  {rentalDetails.totalDays} days
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              {rentalDetails.deliveryRequested ? (
                <Truck className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {rentalDetails.deliveryRequested ? "Delivery" : "Pickup"}
            </h4>
            <div className="space-y-2 text-sm">
              {rentalDetails.deliveryRequested ? (
                <div>
                  <p className="font-medium">Delivery Address:</p>
                  {rentalDetails.deliveryAddress ? (
                    <a
                      href={`https://maps.google.com/maps?q=${encodeURIComponent(rentalDetails.deliveryAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span className="text-sm">
                        {rentalDetails.deliveryAddress}
                      </span>
                      <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ) : (
                    <p className="text-gray-600">Address not specified</p>
                  )}
                  {rentalDetails.deliveryInstructions && (
                    <div className="mt-3 rounded-md bg-blue-50 p-3">
                      <div className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Delivery Instructions
                          </p>
                          <p className="mt-1 text-sm text-blue-700">
                            {rentalDetails.deliveryInstructions}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-medium">Pickup Address:</p>
                  {rentalDetails.pickupAddress ? (
                    <a
                      href={`https://maps.google.com/maps?q=${encodeURIComponent(rentalDetails.pickupAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span className="text-sm">
                        {rentalDetails.pickupAddress}
                      </span>
                      <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ) : (
                    <p className="text-gray-600">Address not available</p>
                  )}
                </div>
              )}
              {rentalDetails.selectedWindow && (
                <div className="mt-2 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>{rentalDetails.selectedWindow}</span>
                </div>
              )}
              {rentalDetails.status === "approved" &&
                rentalDetails.pickupInstructions && (
                  <div className="mt-3 rounded-md bg-blue-50 p-3">
                    <div className="flex gap-2">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {rentalDetails.deliveryRequested
                            ? "Delivery"
                            : "Pickup"}{" "}
                          Instructions
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                          {rentalDetails.pickupInstructions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              {rentalDetails.status === "active" &&
                rentalDetails.returnInstructions && (
                  <div className="mt-3 rounded-md bg-amber-50 p-3">
                    <div className="flex gap-2">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          Return Instructions
                        </p>
                        <p className="mt-1 text-sm text-amber-700">
                          {rentalDetails.returnInstructions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              {rentalDetails.setupRequested && (
                <div className="text-primary mt-2 flex items-center gap-2">
                  <Wrench className="h-3 w-3" />
                  <span className="text-sm font-medium">
                    Setup service requested
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="mb-3 font-semibold">Pricing Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>
                ${parseFloat(rentalDetails.dailyRate).toFixed(2)}/day ×{" "}
                {rentalDetails.totalDays} days
              </span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            {deliveryTotal > 0 && (
              <div className="flex justify-between">
                <span>Delivery fee</span>
                <span>${deliveryTotal.toFixed(2)}</span>
              </div>
            )}
            {setupTotal > 0 && (
              <div className="flex justify-between">
                <span>Setup service</span>
                <span>${setupTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Security deposit</span>
              <span>${securityDeposit.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
