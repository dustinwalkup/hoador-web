import { HandHelping } from "lucide-react";
import { EmptyStateCoach } from "@/components/empty-state-coach";

interface EmptyStateNeedCTAProps {
  type?: "rental" | "service";
  categoryId?: string;
  className?: string;
}

export function EmptyStateNeedCTA({
  type,
  categoryId,
  className,
}: EmptyStateNeedCTAProps) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (categoryId) params.set("category", categoryId);
  const qs = params.toString();
  const href = `/dashboard/needs/new${qs ? `?${qs}` : ""}`;

  return (
    <EmptyStateCoach
      icon={HandHelping}
      iconColor="text-teal-500"
      iconBg="bg-teal-500/10"
      headline="Can't find what you need?"
      description="Post a Neighborhood Need and let a local provider create a listing just for you."
      cta={{ label: "Create Neighborhood Need", href }}
      className={className}
    />
  );
}
