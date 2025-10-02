import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { StatusIconWithTooltip } from "@/features/listings/components/status-icon-with-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ListingCardProps {
  id: string;
  name: string;
  price: string;
  distance?: number; // Changed to optional number (miles)
  rating: number;
  reviews: number;
  imageUrl: string;
  isNew?: boolean;
  status: string;
}

export default function ListingCard({
  id,
  name,
  price,
  distance,
  rating,
  reviews,
  imageUrl,
  isNew = false,
  status,
}: ListingCardProps) {
  // Format distance for display
  const formatDistance = (miles?: number) => {
    if (miles === undefined) return null;
    if (miles < 0.1) return "< 0.1 mi";
    if (miles < 1) return `${Math.round(miles * 5280)} ft`;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
  };
  return (
    <Card className="group overflow-hidden pt-0 pb-2 transition-all hover:shadow-md">
      <div className="relative">
        <div className="bg-muted aspect-[4/3] overflow-hidden">
          <Image
            src={imageUrl || "/images/placeholder.jpg"}
            alt={name}
            width={300}
            height={200}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>

        {/* <Button
          variant="ghost"
          size="icon"
          className="bg-background/80 absolute top-2 right-2 h-8 w-8 rounded-full backdrop-blur-sm"
        >
          <Heart className="h-4 w-4" />
          <span className="sr-only">Add to favorites</span>
        </Button> */}

        {isNew && <Badge className="absolute top-2 left-2">New</Badge>}
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex grow items-start justify-between">
          <h3 className="mr-2 leading-tight font-medium">{name}</h3>
          <span className="text-primary font-medium">{price}</span>
        </div>

        <div className="text-muted-foreground mb-2 flex items-center justify-between text-xs">
          {formatDistance(distance) ? (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{formatDistance(distance)} away</span>
            </div>
          ) : (
            <div />
          )}
          <StatusIconWithTooltip status={status} />
        </div>

        <div className="mb-3 flex items-center gap-1">
          <div className="flex items-center">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="ml-1 text-xs font-medium">{rating}</span>
          </div>
          <span className="text-muted-foreground text-xs">
            ({reviews} reviews)
          </span>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/listings/${id}`}>View</Link>
          </Button>
          <Button asChild size="sm" className="flex-1">
            <Link href={`/listings/${id}/rent`}>Rent</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
