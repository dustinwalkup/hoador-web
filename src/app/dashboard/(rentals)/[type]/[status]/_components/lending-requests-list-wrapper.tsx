import type { LendingRequestItem } from "@/dal/rentals.dal";
import { LendingRequestsList } from "./lending-requests-list";

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
