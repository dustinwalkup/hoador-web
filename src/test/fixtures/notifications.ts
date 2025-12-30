export const mockNotification = {
  id: "notification-123",
  userId: "user-123",
  type: "rental_request",
  title: "New Rental Request",
  message: "Jane Smith requested to rent your Power Drill",
  read: false,
  createdAt: new Date("2024-01-15"),
  data: {
    rentalRequestId: "rental-request-123",
    listingId: "listing-123",
  },
};

export const mockNotificationRead = {
  ...mockNotification,
  id: "notification-124",
  read: true,
  readAt: new Date("2024-01-15"),
};

export const mockNotificationList = [
  mockNotification,
  {
    ...mockNotification,
    id: "notification-125",
    type: "rental_approved",
    title: "Rental Approved",
    message: "Your rental request for Power Drill has been approved",
  },
  mockNotificationRead,
];

export const mockNotificationTypes = [
  "rental_request",
  "rental_approved",
  "rental_denied",
  "rental_cancelled",
  "rental_started",
  "rental_ended",
  "message",
  "review_received",
] as const;
