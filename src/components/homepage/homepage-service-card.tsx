"use client";

import { Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { HomepageServiceMock } from "@/constants/home";
import { cn } from "@/lib/utils";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

interface HomepageServiceCardProps {
  readonly service: HomepageServiceMock;
}

/**
 * Marketing-only service card for the public homepage (mock data).
 */
export function HomepageServiceCard({ service }: HomepageServiceCardProps) {
  const isNew = service.reviewCount === 0;

  return (
    <Card className="group border-border/60 flex h-full flex-col overflow-hidden pt-0 pb-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <CardContent className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex shrink-0 items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage
              src={service.avatarImageUrl ?? undefined}
              alt={service.providerDisplayName}
            />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
              {service.avatarInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate text-sm">
              {service.providerDisplayName}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h3 className="text-foreground text-[15px] leading-snug font-semibold text-balance">
                {service.title}
              </h3>
              <Badge
                variant="secondary"
                className="shrink-0 text-xs font-normal"
              >
                {service.categoryLabel}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mb-4 line-clamp-3 min-h-0 flex-1 text-sm leading-relaxed">
          {service.description}
        </p>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-foreground text-sm font-semibold">
                {formatPrice(service.price)}
                {service.pricingType === "hourly" ? (
                  <span className="text-muted-foreground font-normal">/hr</span>
                ) : (
                  <>
                    {" "}
                    <span className="text-muted-foreground font-normal">
                      ·
                    </span>{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      flat rate
                    </span>
                  </>
                )}
              </span>
            </div>

            {isNew ? (
              <Badge
                variant="secondary"
                className="bg-secondary/80 rounded-full px-2.5 py-0.5 text-xs font-medium"
              >
                New
              </Badge>
            ) : (
              <div className="flex items-center gap-1 text-sm">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="text-foreground font-medium">
                  {service.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({service.reviewCount})
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("pointer-events-none flex-1")}
              tabIndex={-1}
              aria-hidden="true"
            >
              View
            </Button>
            <Button
              type="button"
              size="sm"
              className="pointer-events-none flex-1"
              tabIndex={-1}
              aria-hidden="true"
            >
              Book
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
