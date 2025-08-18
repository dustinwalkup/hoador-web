import type { BorrowedTool } from "@/dal/rentals.dal";
import { BorrowedToolsList } from "./borrowed-tools-list";

interface BorrowedToolsListWrapperProps {
  data: BorrowedTool[];
  currentTab: string;
  emptyStateMessage?: string;
  emptyStateAction?: {
    label: string;
    href: string;
  };
}

export function BorrowedToolsListWrapper(props: BorrowedToolsListWrapperProps) {
  return <BorrowedToolsList {...props} />;
}
