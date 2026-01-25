export const PLATFORM_FEE_PERCENTAGE = 0.1;

export const PAYMENTS_TABS = {
  title: "Payments",
  description: "Manage your payment methods and earnings",
  tabValues: [
    { value: "payments", label: "Payment Methods" },
    { value: "earnings-and-payouts", label: "Earnings & Payouts" },
  ],
} as const;

export const PAYMENTS_PAGE_HEADERS = {
  payments: {
    title: "Payments",
    description: "Manage your payment methods and view payment history",
  },
  "earnings-and-payouts": {
    title: "Earnings & Payouts",
    description: "Manage your earnings, payouts, and Stripe Connect account",
  },
} as const;
