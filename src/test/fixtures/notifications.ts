import type { NotificationWithUser } from "@/dal/notifications.dal";
import type { Notification } from "@/features/notifications/hooks/use-notifications";

export const mockUser = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
  image: "https://example.com/profile.jpg",
};

export const mockNotification: Notification = {
  id: "notification-123",
  userId: "user-123",
  type: "rental_request_created",
  title: "New Rental Request",
  message: "You have a new rental request for your power drill",
  data: {
    rentalId: "rental-123",
    listingId: "listing-123",
  },
  isRead: false,
  readAt: null,
  createdAt: new Date("2024-01-15T10:00:00"),
};

export const mockNotificationRead: Notification = {
  ...mockNotification,
  id: "notification-124",
  isRead: true,
  readAt: new Date("2024-01-15T10:05:00"),
};

export const mockNotificationUnread: Notification = {
  ...mockNotification,
  id: "notification-125",
  type: "rental_approved",
  title: "Rental Approved",
  message: "Your rental request has been approved",
  isRead: false,
  readAt: null,
};

export const mockNotifications: Notification[] = [
  mockNotification,
  mockNotificationRead,
  mockNotificationUnread,
  {
    ...mockNotification,
    id: "notification-126",
    type: "payment_succeeded",
    title: "Payment Received",
    message: "Payment of $50.00 has been processed",
    isRead: false,
    createdAt: new Date("2024-01-14T15:00:00"),
  },
  {
    ...mockNotification,
    id: "notification-127",
    type: "review_received",
    title: "New Review",
    message: "You received a 5-star review",
    isRead: true,
    readAt: new Date("2024-01-13T12:00:00"),
    createdAt: new Date("2024-01-13T11:00:00"),
  },
];

export const mockNotificationWithUser: NotificationWithUser = {
  id: "notification-123",
  userId: "user-123",
  type: "rental_request_created",
  title: "New Rental Request",
  message: "You have a new rental request for your power drill",
  data: {
    rentalId: "rental-123",
    listingId: "listing-123",
  },
  isRead: false,
  readAt: null,
  createdAt: new Date("2024-01-15T10:00:00"),
  user: {
    id: "user-123",
    name: "John Doe",
    email: "john@example.com",
    image: "https://example.com/profile.jpg",
  },
};

export const mockNotificationsWithUser: NotificationWithUser[] = [
  mockNotificationWithUser,
  {
    ...mockNotificationWithUser,
    id: "notification-124",
    isRead: true,
    readAt: new Date("2024-01-15T10:05:00"),
  },
  {
    ...mockNotificationWithUser,
    id: "notification-125",
    type: "rental_approved",
    title: "Rental Approved",
    message: "Your rental request has been approved",
    isRead: false,
    readAt: null,
  },
];

export const mockNotificationsResponse = {
  data: mockNotifications,
  pagination: {
    page: 1,
    limit: 20,
    total: mockNotifications.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

// Database schema type fixture (matches notifications table)
export const mockNotificationDbRecord = {
  id: "notification-123",
  userId: "user-123",
  type: "rental_request_created" as const,
  title: "New Rental Request",
  message: "You have a new rental request for your power drill",
  data: {
    rentalId: "rental-123",
    listingId: "listing-123",
  },
  isRead: false,
  readAt: null,
  createdAt: new Date("2024-01-15T10:00:00"),
};

// Edge case fixtures
export const mockNotificationLongMessage: Notification = {
  ...mockNotification,
  id: "notification-long",
  message:
    "This is a very long notification message that should be truncated when displayed in the UI to prevent it from taking up too much space and breaking the layout of the notification card component",
};

export const mockNotificationWithLinkUrl: Notification = {
  ...mockNotification,
  id: "notification-link",
  data: {
    ...mockNotification.data,
    linkUrl: "/dashboard/rentals/rental-123",
  },
};

export const mockNotificationSystem: Notification = {
  ...mockNotification,
  id: "notification-system",
  type: "system",
  title: "System Update",
  message: "The system will be under maintenance tonight",
};
