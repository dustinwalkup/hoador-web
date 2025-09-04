import type { BorrowedListing } from "@/dal/rentals.dal";
import { BorrowedListingsList } from "./borrowed-listings-list";

interface BorrowedListingsListWrapperProps {
  data: BorrowedListing[];
  currentTab: string;
  emptyStateMessage?: string;
  emptyStateAction?: {
    label: string;
    href: string;
  };
}

export function BorrowedListingsListWrapper(
  props: BorrowedListingsListWrapperProps,
) {
  return <BorrowedListingsList {...props} />;
}
