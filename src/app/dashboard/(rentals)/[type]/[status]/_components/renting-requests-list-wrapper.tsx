import type { RentalRequestItem } from "@/lib/dal/rentals.dal";
import { RentingRequestsList } from "./renting-requests-list";

interface RentingRequestsListWrapperProps {
  data: RentalRequestItem[];
  emptyStateMessage?: string;
  emptyStateAction?: {
    label: string;
    href: string;
  };
}

export function RentingRequestsListWrapper(
  props: RentingRequestsListWrapperProps,
) {
  return <RentingRequestsList {...props} />;
}
