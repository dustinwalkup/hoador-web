import { Bell, MessageSquare, PlusCircle } from "lucide-react";

interface HeaderConstants {
  readonly titleFor: (userName: string) => string;
  readonly description: string;
}

export interface DashboardConstants {
  readonly header: HeaderConstants;
}

export const DASHBOARD_PAGE = {
  header: {
    titleFor: (name: string) => `Welcome back, ${name}!`,
    description: "Here's what's happening with your tools and rentals.",
  },
  quickActions: {
    title: "Quick Actions:",
    buttons: [
      {
        id: 1,
        label: "Add New Listing",
        icon: <PlusCircle className="mr-1 h-3.5 w-3.5" />,
        buttonVariant: "default",
      },
      {
        id: 2,
        label: "Respond to Requests",
        icon: <MessageSquare className="mr-1 h-3.5 w-3.5" />,
        buttonVariant: "outline",
      },
      {
        id: 3,
        label: "Create Reminder",
        icon: <Bell className="mr-1 h-3.5 w-3.5" />,
        buttonVariant: "outline",
      },
    ],
  },
  alerts: {
    title: "Overdue Alerts",
    itemsLabel: "items",
    actionLabel: "Resolve",
    viewAllLabel: "View All",
    items: [
      {
        id: 1,
        title: "Return Pressure Washer",
        status: "3 days late",
        person: "John D.",
        actionable: true,
      },
      {
        id: 2,
        title: "Return Ladder",
        status: "1 day late",
        person: "Robert T.",
        actionable: true,
      },
    ],
  },
  pendingRequests: {
    title: "Pending Requests",
    decline: "Decline",
    accept: "Accept",
    from: "from",
    requests: "requests",
    viewAllLabel: "View All Requests",
    items: [
      {
        id: 1,
        title: "Drill Set",
        status: "2 days left to respond",
        person: "Emily K.",
        actionable: true,
      },
      {
        id: 2,
        title: "Lawn Mower",
        status: "3 days left to respond",
        person: "Raj P.",
        actionable: true,
      },
      {
        id: 3,
        title: "Lawn Mower from Raj P.",
        status: "3 days left to respond",
        person: "Raj P.",
        actionable: true,
      },
      {
        id: 4,
        title: "Lawn Mower from Raj P.",
        status: "3 days left to respond",
        person: "Raj P.",
        actionable: true,
      },
    ],
  },
};
