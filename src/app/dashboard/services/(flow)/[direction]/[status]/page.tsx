export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ServicesFlowClient } from "@/features/services/components/services-flow-client";

const VALID_DIRECTIONS = ["incoming", "outgoing"] as const;
const VALID_STATUSES = [
  "pending",
  "accepted",
  "completed",
  "declined",
  "cancelled",
] as const;

type ValidDirection = (typeof VALID_DIRECTIONS)[number];
type ValidStatus = (typeof VALID_STATUSES)[number];

interface ServicesFlowPageProps {
  params: Promise<{ direction: string; status: string }>;
}

function ServicesLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-muted size-10 animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
              <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
            </div>
            <div className="flex gap-2">
              <div className="bg-muted h-5 w-20 animate-pulse rounded" />
              <div className="bg-muted h-5 w-16 animate-pulse rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ServicesFlowPage({
  params,
}: ServicesFlowPageProps) {
  const { direction, status } = await params;

  if (
    !(VALID_DIRECTIONS as readonly string[]).includes(direction) ||
    !(VALID_STATUSES as readonly string[]).includes(status)
  ) {
    notFound();
  }

  const initialRole =
    (direction as ValidDirection) === "incoming" ? "provider" : "requester";

  return (
    <Suspense fallback={<ServicesLoadingSkeleton />}>
      <ServicesFlowClient
        initialRole={initialRole}
        initialStatus={status as ValidStatus}
      />
    </Suspense>
  );
}
