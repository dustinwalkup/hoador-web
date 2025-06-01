import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface ToolCardProps {
  id: string;
  name: string;
  price: string;
  distance: string;
  rating: number;
  reviews: number;
  imageUrl: string;
  isNew?: boolean;
}

export default function ToolCard({
  id,
  name,
  price,
  distance,
  rating,
  reviews,
  imageUrl,
  isNew = false,
}: ToolCardProps) {
  return (
    <Card className="group overflow-hidden pt-0 pb-2 transition-all hover:shadow-md">
      <div className="relative">
        <div className="bg-muted aspect-[4/3] overflow-hidden">
          <Image
            src={imageUrl || "/placeholder.svg"}
            alt={name}
            width={300}
            height={200}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="bg-background/80 absolute top-2 right-2 h-8 w-8 rounded-full backdrop-blur-sm"
        >
          <Heart className="h-4 w-4" />
          <span className="sr-only">Add to favorites</span>
        </Button>

        {isNew && <Badge className="absolute top-2 left-2">New</Badge>}
      </div>

      <CardContent className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-medium">{name}</h3>
          <span className="text-primary font-medium">{price}</span>
        </div>

        <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3" />
          <span>{distance} away</span>
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
            <Link href={`/dashboard/tool/${id}`}>View</Link>
          </Button>
          <Button size="sm" className="flex-1">
            Rent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
