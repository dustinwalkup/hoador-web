import FavoritesClientComponent from "@/components/dashboard/favorites-client-component";

export default async function FavoritesPage() {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return (
    <div>
      <FavoritesClientComponent />
    </div>
  );
}
