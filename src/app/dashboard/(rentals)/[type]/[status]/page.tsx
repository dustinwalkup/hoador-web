import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rentalDAL } from "@/lib/dal";
import type {
  RentalRequestItem,
  LendingRequestItem,
  BorrowedTool,
} from "@/lib/dal/rentals.dal";
import { RentingRequestsList } from "./_components/renting-requests-list";
import { LendingRequestsList } from "./_components/lending-requests-list";
import { BorrowedToolsList } from "./_components/borrowed-tools-list";

interface RentalsPageProps {
  params: Promise<{
    type: "renting" | "lending";
    status: "requests" | "active" | "completed" | "rejected" | "incoming";
  }>;
}

type StatusConfig = {
  displayName: string;
  emptyMessage: string;
  emptyAction?: { label: string; href: string };
};

// Valid routes configuration
const validRoutes: Record<string, Record<string, StatusConfig>> = {
  renting: {
    requests: {
      displayName: "My Requests",
      emptyMessage: "No pending requests.",
      emptyAction: { label: "Browse Tools", href: "/explore" },
    },
    active: {
      displayName: "Active",
      emptyMessage: "No active rentals.",
    },
    completed: {
      displayName: "Completed",
      emptyMessage: "No completed rentals.",
    },
    rejected: {
      displayName: "Rejected",
      emptyMessage: "No rejected requests.",
    },
  },
  lending: {
    incoming: {
      displayName: "Incoming",
      emptyMessage: "No incoming requests.",
    },
    active: {
      displayName: "Active",
      emptyMessage: "No active lending.",
    },
    completed: {
      displayName: "Completed",
      emptyMessage: "No completed lending.",
    },
    rejected: {
      displayName: "Rejected",
      emptyMessage: "No rejected requests.",
    },
  },
};

export default async function RentalsStatusPage({ params }: RentalsPageProps) {
  const { type, status } = await params;

  // Validate route parameters
  if (!validRoutes[type] || !validRoutes[type][status]) {
    notFound();
  }

  const typeConfig = validRoutes[type];
  const statusConfig = typeConfig[status];

  // Get real data for ALL tabs - no more mock data!
  let rentalRequestsData: RentalRequestItem[] = [];
  let lendingRequestsData: LendingRequestItem[] = [];
  let borrowedToolsData: BorrowedTool[] = [];
  let error: string | undefined;

  if (type === "renting" && status === "requests") {
    try {
      rentalRequestsData = await rentalDAL.getRentalRequestsByStatus("pending");
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch rental requests";
    }
  } else if (type === "renting" && status === "rejected") {
    try {
      rentalRequestsData =
        await rentalDAL.getRentalRequestsByStatus("rejected");
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch rental requests";
    }
  } else if (type === "renting" && status === "active") {
    try {
      const borrowedData = await rentalDAL.getBorrowedTools();
      borrowedToolsData = borrowedData.currentRentals;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch active rentals";
    }
  } else if (type === "renting" && status === "completed") {
    try {
      borrowedToolsData = await rentalDAL.getRentalsByStatus("completed");
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Failed to fetch completed rentals";
    }
  } else if (type === "lending" && status === "incoming") {
    try {
      lendingRequestsData =
        await rentalDAL.getLendingRequestsByStatus("pending");
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch lending requests";
    }
  } else if (type === "lending" && status === "rejected") {
    try {
      lendingRequestsData =
        await rentalDAL.getLendingRequestsByStatus("rejected");
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch lending requests";
    }
  } else if (type === "lending" && status === "active") {
    try {
      lendingRequestsData = await rentalDAL.getLendingRentalsByStatus("active");
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch active lending";
    }
  } else if (type === "lending" && status === "completed") {
    try {
      lendingRequestsData =
        await rentalDAL.getLendingRentalsByStatus("completed");
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : "Failed to fetch completed lending";
    }
  }

  // Generate tab items without counts for now (can add real counts later)
  const tabItems = Object.entries(typeConfig).map(([statusKey, config]) => {
    return {
      value: statusKey,
      label: config.displayName,
      href: `/dashboard/${type}/${statusKey}`,
    };
  });

  return (
    <div className="space-y-6">
      <Tabs value={status}>
        <TabsList className="mb-6 grid w-full grid-cols-4">
          {tabItems.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <a href={tab.href}>{tab.label}</a>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={status}>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">Error: {error}</p>
            </div>
          )}

          {type === "renting" &&
          (status === "requests" || status === "rejected") ? (
            <RentingRequestsList
              data={rentalRequestsData}
              emptyStateMessage={statusConfig.emptyMessage}
              emptyStateAction={statusConfig.emptyAction}
            />
          ) : type === "renting" &&
            (status === "active" || status === "completed") ? (
            <BorrowedToolsList
              data={borrowedToolsData}
              currentTab={status}
              emptyStateMessage={statusConfig.emptyMessage}
              emptyStateAction={statusConfig.emptyAction}
            />
          ) : type === "lending" ? (
            <LendingRequestsList
              data={lendingRequestsData}
              emptyStateMessage={statusConfig.emptyMessage}
              emptyStateAction={statusConfig.emptyAction}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
