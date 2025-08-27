import type { LendingRequestItem } from "@/dal/rentals.dal";
import { LendingRequestsList } from "@/features/rentals/components/renting-lending";

interface LendingRequestsListWrapperProps {
  data: LendingRequestItem[];
  emptyStateMessage?: string;
  emptyStateAction?: {
    label: string;
    href: string;
  };
}

export function LendingRequestsListWrapper(
  props: LendingRequestsListWrapperProps,
) {
  return <LendingRequestsList {...props} />;
}
