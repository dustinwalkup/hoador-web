interface HeaderConstants {
  readonly titleFor: (userName: string) => string;
  readonly description: string;
}

interface AlertItem {
  readonly id: number;
  readonly title: string;
  readonly status: string;
  readonly person: string;
  readonly actionable: boolean;
}

interface AlertsConstants {
  readonly title: string;
  readonly itemsLabel: string;
  readonly actionLabel: string;
  readonly viewAllLabel: string;
  readonly items: readonly AlertItem[];
}

interface PendingRequestItem {
  readonly id: number;
  readonly title: string;
  readonly status: string;
  readonly person: string;
  readonly actionable: boolean;
}

interface PendingRequestsConstants {
  readonly title: string;
  readonly decline: string;
  readonly accept: string;
  readonly from: string;
  readonly requests: string;
  readonly viewAllLabel: string;
  readonly items: readonly PendingRequestItem[];
}

export interface DashboardConstants {
  readonly header: HeaderConstants;
  readonly alerts: AlertsConstants;
  readonly pendingRequests: PendingRequestsConstants;
}

export const DASHBOARD_PAGE = {
  header: {
    titleFor: (name: string) => `Welcome back, ${name}!`,
    description: "Here's what's happening with your listings and rentals.",
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
