"use client";

import { MapPin } from "lucide-react";
import Image from "next/image";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ToolSummaryCardProps {
  tool: {
    name: string;
    dailyRate: number;
    owner: {
      firstName: string;
      lastName: string;
    };
    images: Array<{ imageUrl: string }>;
  };
  pricing: {
    days: number;
    subtotal: number;
    deliveryFee: number;
    securityDeposit: number;
    total: number;
  };
}

export function ToolSummaryCard({ tool, pricing }: ToolSummaryCardProps) {
  const firstImage = tool.images?.[0]?.imageUrl || "/images/placeholder.jpg";

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex gap-3">
          <Image
            src={firstImage}
            alt={tool.name}
            width={80}
            height={80}
            className="rounded-lg object-cover"
          />
          <div>
            <h3 className="font-semibold">{tool.name}</h3>
            <p className="text-sm text-gray-600">
              by {tool.owner.firstName} {tool.owner.lastName}
            </p>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="h-3 w-3" />
              Owner location
            </div>
          </div>
        </div>

        {pricing.days > 0 && (
          <>
            <Separator className="mb-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>
                  ${tool.dailyRate}/day × {pricing.days} days
                </span>
                <span>${pricing.subtotal.toFixed(2)}</span>
              </div>
              {pricing.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span>${pricing.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Security deposit</span>
                <span>${pricing.securityDeposit.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${pricing.total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
