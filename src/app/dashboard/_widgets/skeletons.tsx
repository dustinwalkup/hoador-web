import { Skeleton } from "@/components/ui/skeleton";

/**
 * Widget-level Suspense fallbacks. Dimensions mirror the rendered widgets
 * to minimize CLS when streamed content replaces the skeleton.
 */

function Card({ className = "" }: { className?: string }) {
  return (
    <Skeleton
      className={`bg-card border-border rounded-xl border ${className}`}
    />
  );
}

export function QuickActionsSkeleton() {
  return <Card className="h-20 w-full" />;
}

export function DashboardPulseSkeleton() {
  return <Card className="h-40 w-full" />;
}

export function AlertsRowSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-64 w-full" />
      <Card className="h-64 w-full" />
    </div>
  );
}

export function PendingRequestsSkeleton() {
  return <Card className="h-56 w-full" />;
}

export function UnreadMessagesSkeleton() {
  return <Card className="h-56 w-full" />;
}

export function RecentActivitySkeleton() {
  return <Card className="h-80 w-full" />;
}

export function ActiveDisputesSkeleton() {
  return <Card className="h-48 w-full" />;
}
