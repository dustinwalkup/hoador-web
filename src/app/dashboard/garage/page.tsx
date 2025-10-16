export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { GarageClient } from "./_components/garage-client";

export const metadata = {
  title: "Garage | Hoador",
  description: "Manage your tool listings and inventory",
};

export default function GaragePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GarageClient />
    </Suspense>
  );
}
