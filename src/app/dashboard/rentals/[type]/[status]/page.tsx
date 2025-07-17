import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalsList } from "@/components/rentals/rentals-list";
import { mockRentalsData } from "@/lib/data/mock-rentals";
import { rentalDAL } from "@/lib/dal";
import type { RentalType } from "@/lib/types/rentals";
import type { RentalRequestItem } from "@/lib/dal/rentals.dal";
import { RentingRequestsList } from "./_components/renting-requests-list";

interface RentalsPageProps {
  params: Promise<{
    type: string;
    status: string;
  }>;
}

type StatusConfig = {
  dataKey:
    | keyof typeof mockRentalsData.renting
    | keyof typeof mockRentalsData.lending;
  displayName: string;
  emptyMessage: string;
  emptyAction?: { label: string; href: string };
};

// Valid routes configuration
const validRoutes: Record<string, Record<string, StatusConfig>> = {
  renting: {
    requests: {
      dataKey: "requests",
      displayName: "My Requests",
      emptyMessage: "No pending requests.",
      emptyAction: { label: "Browse Tools", href: "/explore" },
    },
    active: {
      dataKey: "active",
      displayName: "Active",
      emptyMessage: "No active rentals.",
    },
    completed: {
      dataKey: "completed",
      displayName: "Completed",
      emptyMessage: "No completed rentals.",
    },
    rejected: {
      dataKey: "rejected",
      displayName: "Rejected",
      emptyMessage: "No rejected requests.",
    },
  },
  lending: {
    incoming: {
      dataKey: "incoming",
      displayName: "Incoming",
      emptyMessage: "No incoming requests.",
    },
    active: {
      dataKey: "active",
      displayName: "Active",
      emptyMessage: "No active lending.",
    },
    completed: {
      dataKey: "completed",
      displayName: "Completed",
      emptyMessage: "No completed lending.",
    },
    rejected: {
      dataKey: "rejected",
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

  // Get real data for renting requests, fallback to mock data for others
  let rentalRequestsData: RentalRequestItem[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockData: any[] = [];
  let error: string | undefined;

  if (type === "renting" && status === "requests") {
    try {
      rentalRequestsData = await rentalDAL.getRentalRequestsByStatus("pending");
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch rental requests";
    }
  } else if (
    type === "renting" &&
    (status === "active" || status === "completed")
  ) {
    try {
      const borrowedData = await rentalDAL.getBorrowedTools();
      // Map borrowed tools data to match the expected format
      mockData = status === "active" ? borrowedData.currentRentals : []; // We don't have completed rentals from getBorrowedTools yet
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch borrowed tools";
    }
  } else {
    // Use mock data for other scenarios
    const typeData =
      type === "renting" ? mockRentalsData.renting : mockRentalsData.lending;
    mockData = typeData[statusConfig.dataKey as keyof typeof typeData];
  }

  // Generate tab items with counts (using mock data for counts for now)
  const typeData =
    type === "renting" ? mockRentalsData.renting : mockRentalsData.lending;
  const tabItems = Object.entries(typeConfig).map(([statusKey, config]) => {
    const configData = typeData[config.dataKey as keyof typeof typeData];
    const count = Array.isArray(configData) ? configData.length : 0;
    return {
      value: statusKey,
      label: `${config.displayName} (${count})`,
      href: `/dashboard/rentals/${type}/${statusKey}`,
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

          {type === "renting" && status === "requests" ? (
            <RentingRequestsList
              data={rentalRequestsData}
              emptyStateMessage={statusConfig.emptyMessage}
              emptyStateAction={statusConfig.emptyAction}
            />
          ) : (
            <RentalsList
              data={mockData}
              type={type as RentalType}
              status={status}
              emptyStateMessage={statusConfig.emptyMessage}
              emptyStateAction={statusConfig.emptyAction}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
