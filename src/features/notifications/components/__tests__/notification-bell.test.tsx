import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "../notification-bell";
import {
  mockNotifications,
  mockNotificationsResponse,
} from "@/test/fixtures/notifications";
import {
  useMarkAsRead,
  useToggleReadStatus,
} from "../../hooks/use-notifications";
import { useDashboardBadges } from "@/features/dashboard/hooks/use-dashboard-badges";

// Mock the hooks
vi.mock("../../hooks/use-notifications");
vi.mock("@/features/dashboard/hooks/use-dashboard-badges");
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

type BadgeResult = {
  data?: {
    unreadMessages: number;
    unreadNotifications: number;
    notifications: typeof mockNotificationsResponse;
  };
  isLoading: boolean;
  error: Error | null;
};

function setBadges(result: BadgeResult) {
  vi.mocked(useDashboardBadges).mockReturnValue(result as any);
}

function badgeData(
  unreadNotifications: number,
  notifications = mockNotificationsResponse,
) {
  return {
    data: {
      unreadMessages: 0,
      unreadNotifications,
      notifications,
    },
    isLoading: false,
    error: null,
  } satisfies BadgeResult;
}

describe("NotificationBell", () => {
  const mockMarkAsRead = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };
  const mockToggleReadStatus = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setBadges(badgeData(3));
    vi.mocked(useMarkAsRead).mockReturnValue(mockMarkAsRead as any);
    vi.mocked(useToggleReadStatus).mockReturnValue(mockToggleReadStatus as any);
  });

  describe("Rendering", () => {
    it("should render bell icon", () => {
      // Act
      render(<NotificationBell />);

      // Assert
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
    });

    it("should display unread count badge when count > 0", () => {
      // Arrange
      setBadges(badgeData(5));

      // Act
      render(<NotificationBell />);

      // Assert
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("should hide badge when count is 0", () => {
      // Arrange
      setBadges(badgeData(0));

      // Act
      render(<NotificationBell />);

      // Assert
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("should hide badge when count is loading", () => {
      // Arrange
      setBadges({ data: undefined, isLoading: true, error: null });

      // Act
      render(<NotificationBell />);

      // Assert - badge should not show while loading
      const badge = screen.queryByText(/^\d+$/);
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe("User Interaction", () => {
    it("should open dropdown when bell is clicked", async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(<NotificationBell />);
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Assert
      // Multiple elements have "Notifications" text (sr-only span and dropdown label)
      // Check that the dropdown menu is open by verifying the menu content appears
      const notificationsTexts = screen.getAllByText("Notifications");
      expect(notificationsTexts.length).toBeGreaterThan(0);
      // Also verify the dropdown menu is visible by checking for the "Mark all as read" button
      expect(
        screen.getByRole("button", { name: /mark all as read/i }),
      ).toBeInTheDocument();
    });

    it("should mark notification as read and navigate when clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<NotificationBell />);

      // Act - open dropdown first
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Wait for dropdown to open
      // Multiple notifications may have the same title, so use getAllByText
      await waitFor(() => {
        const notifications = screen.getAllByText(mockNotifications[0].title);
        expect(notifications.length).toBeGreaterThan(0);
      });

      // Click on the first notification with this title
      const notifications = screen.getAllByText(mockNotifications[0].title);
      await user.click(notifications[0]);

      // Assert
      await waitFor(() => {
        expect(mockMarkAsRead.mutateAsync).toHaveBeenCalledWith({
          notificationId: mockNotifications[0].id,
        });
      });
    });

    it("should mark all as read when button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<NotificationBell />);

      // Act - open dropdown first
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Wait for dropdown and find "Mark all as read" button
      await waitFor(() => {
        expect(screen.getByText("Mark all as read")).toBeInTheDocument();
      });

      const markAllButton = screen.getByText("Mark all as read");
      await user.click(markAllButton);

      // Assert
      await waitFor(() => {
        expect(mockMarkAsRead.mutateAsync).toHaveBeenCalledWith({
          markAll: true,
        });
      });
    });
  });

  describe("Loading State", () => {
    it("should show loader during fetch", () => {
      // Arrange
      setBadges({ data: undefined, isLoading: true, error: null });

      // Act
      render(<NotificationBell />);
      const bellButton = screen.getByRole("button", { name: /notifications/i });

      // Open dropdown to see loading state
      userEvent.click(bellButton);

      // Assert - loader should be visible (this would be in the dropdown content)
      // Since dropdown is rendered in a portal, we need to wait for it
    });
  });

  describe("Error State", () => {
    it("should show error message on failure", async () => {
      // Arrange
      const user = userEvent.setup();
      setBadges({
        data: undefined,
        isLoading: false,
        error: new Error("Failed to load notifications"),
      });

      // Act
      render(<NotificationBell />);
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText("Failed to load notifications"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should show 'No notifications yet' message when empty", async () => {
      // Arrange
      const user = userEvent.setup();
      setBadges(
        badgeData(0, {
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }),
      );

      // Act
      render(<NotificationBell />);
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("No notifications yet")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      // Act
      render(<NotificationBell />);

      // Assert
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      expect(bellButton).toHaveAttribute("aria-label", "Notifications");
    });

    it("should have screen reader text for notifications", () => {
      // Act
      render(<NotificationBell />);

      // Assert
      const srOnly = screen.getByText("Notifications", {
        selector: ".sr-only",
      });
      expect(srOnly).toBeInTheDocument();
    });
  });

  describe("Real-time Updates", () => {
    it("should update unread count when notifications change", () => {
      // Arrange
      setBadges(badgeData(3));

      // Act
      const { rerender } = render(<NotificationBell />);
      expect(screen.getByText("3")).toBeInTheDocument();

      // Update count
      setBadges(badgeData(5));

      rerender(<NotificationBell />);

      // Assert
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  describe("Mark All as Read Button", () => {
    it("should only show when there are unread notifications", async () => {
      // Arrange
      const user = userEvent.setup();
      setBadges(badgeData(0));

      // Act
      render(<NotificationBell />);
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByText("Mark all as read")).not.toBeInTheDocument();
      });
    });

    it("should be disabled when mark as read is pending", async () => {
      // Arrange
      const user = userEvent.setup();
      mockMarkAsRead.isPending = true;

      // Act
      render(<NotificationBell />);
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      await user.click(bellButton);

      // Assert
      await waitFor(() => {
        const markAllButton = screen
          .getByText("Mark all as read")
          .closest("button");
        expect(markAllButton).toBeDisabled();
      });
    });
  });
});
