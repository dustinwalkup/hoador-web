export const dynamic = "force-dynamic";
import FavoritesClientComponent from "@/components/dashboard/favorites-client-component";

export const metadata = {
  title: "Favorites | Hoador",
  description: "Your saved and favorited listings",
};

export default async function FavoritesPage() {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return (
    <div>
      <FavoritesClientComponent />
    </div>
  );
}
