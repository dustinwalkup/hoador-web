"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FavoritesButtonProps {
  listingId: string;
  isFavorite: boolean;
}

export function FavoritesButton({
  listingId,
  isFavorite,
}: FavoritesButtonProps) {
  const [isFavorited, setIsFavorited] = useState(isFavorite);
  const [isPending, startTransition] = useTransition();

  const handleFavorite = () => {
    const newState = !isFavorited;
    setIsFavorited(newState); // Optimistic update

    startTransition(async () => {
      // TODO: Implement server action to toggle favorite
      // await toggleFavoriteAction(listingId, newState);
    });
  };

  return (
    <Button
      variant="outline"
      className="w-full bg-transparent"
      onClick={handleFavorite}
      disabled={isPending}
    >
      <Heart
        className={`mr-2 h-4 w-4 ${isFavorited ? "fill-current text-red-500" : ""}`}
      />
      {isFavorited ? "Remove from Favorites" : "Add to Favorites"}
    </Button>
  );
}
