import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalsList } from "@/components/rentals/rentals-list";
import { mockRentalsData } from "@/lib/data/mock-rentals";
import type { RentalType } from "@/lib/types/rentals";

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

  // Get data based on type and status
  const typeData =
    type === "renting" ? mockRentalsData.renting : mockRentalsData.lending;
  const data = typeData[statusConfig.dataKey as keyof typeof typeData];

  // Generate tab items with counts
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
          <RentalsList
            data={data}
            type={type as RentalType}
            status={status}
            emptyStateMessage={statusConfig.emptyMessage}
            emptyStateAction={statusConfig.emptyAction}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
