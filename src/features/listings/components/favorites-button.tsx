// "use client";

// import { useState, useTransition } from "react";
// import { Heart } from "lucide-react";
// import { Button } from "@/components/ui/button";

// export function FavoritesButton({ isFavorite }: { isFavorite: boolean }) {
//   const [isFavorited, setIsFavorited] = useState(isFavorite);
//   const [isPending, startTransition] = useTransition();

//   const handleFavorite = () => {
//     const newState = !isFavorited;
//     setIsFavorited(newState); // Optimistic update

//     startTransition(async () => {});
//   };

//   return (
//     <Button
//       variant="outline"
//       className="w-full bg-transparent"
//       onClick={handleFavorite}
//       disabled={isPending}
//     >
//       <Heart
//         className={`mr-2 h-4 w-4 ${isFavorited ? "fill-current text-red-500" : ""}`}
//       />
//       {isFavorited ? "Remove from Favorites" : "Add to Favorites"}
//     </Button>
//   );
// }
