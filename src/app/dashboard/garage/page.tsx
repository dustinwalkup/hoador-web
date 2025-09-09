import { Suspense } from "react";
import { GarageClient } from "./_components/garage-client";

export default function GaragePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GarageClient />
    </Suspense>
  );
}
