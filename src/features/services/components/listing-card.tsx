import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ServiceListingBrowseItem } from "@/dal/service-listing.dal";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function getInitials(
  firstName: string | null,
  lastName?: string | null,
): string {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function getFullName(
  firstName: string | null,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Provider";
}

export function ListingCard({
  listing,
}: {
  listing: ServiceListingBrowseItem;
}) {
  const initials = getInitials(
    listing.providerFirstName,
    listing.providerLastName,
  );
  const fullName = getFullName(
    listing.providerFirstName,
    listing.providerLastName,
  );
  const rating =
    listing.aggregateRating != null ? Number(listing.aggregateRating) : null;
  const hasRating = rating != null && rating > 0;
  const isNew = !hasRating && listing.reviewCount === 0;

  return (
    <Link
      href={`/dashboard/services/listings/${listing.id}`}
      className="group border-border/60 bg-card hover:border-border relative flex h-full flex-col rounded-xl border p-5! transition-all duration-200 hover:shadow-md"
    >
      {/* Provider Info */}
      <div className="mb-4 flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage
            src={listing.providerProfileImageUrl ?? undefined}
            alt={fullName}
          />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm">{fullName}</p>
          <h3 className="text-foreground text-[15px] leading-snug font-semibold text-balance">
            {listing.title}
          </h3>
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <p className="text-muted-foreground mb-4 line-clamp-2 text-sm leading-relaxed">
          {listing.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-foreground text-sm font-semibold">
            {formatPrice(Number(listing.price))}
            {listing.pricingType === "hourly" ? (
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
        ) : hasRating ? (
          <div className="flex items-center gap-1 text-sm">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            <span className="text-foreground font-medium">
              {rating?.toFixed(1)}
            </span>
            <span className="text-muted-foreground">
              ({listing.reviewCount})
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
