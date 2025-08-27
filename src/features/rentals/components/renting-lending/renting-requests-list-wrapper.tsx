import type { RentalRequestItem } from "@/dal/rentals.dal";
import { RentingRequestsList } from "@/features/rentals/components/renting-lending";

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
