/**
 * Component tests for offline-indicator.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OfflineIndicator } from "../offline-indicator";

// Mock network-status hook
vi.mock("@/lib/pwa/network-status", () => ({
  useNetworkStatus: vi.fn(),
}));

import { useNetworkStatus } from "@/lib/pwa/network-status";

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when online", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOffline: false,
      justCameOnline: false,
      justWentOffline: false,
      isOnline: true,
      wasOffline: false,
      status: {
        isOnline: true,
        wasOffline: false,
      },
    });

    const { container } = render(<OfflineIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it("should render when offline", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOffline: true,
      justCameOnline: false,
      justWentOffline: true,
      isOnline: false,
      wasOffline: false,
      status: {
        isOnline: false,
        wasOffline: false,
      },
    });

    render(<OfflineIndicator />);

    expect(
      screen.getByText(/You're offline. Some features may not be available/i),
    ).toBeInTheDocument();
  });

  it("should show online message when coming back online", async () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOffline: false,
      justCameOnline: true,
      justWentOffline: false,
      isOnline: true,
      wasOffline: false,
      status: {
        isOnline: true,
        wasOffline: false,
      },
    });

    render(<OfflineIndicator showOnlineMessage={true} />);

    await waitFor(() => {
      expect(screen.getByText(/You're back online!/i)).toBeInTheDocument();
    });
  });

  it("should respect showWhenOffline prop", () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOffline: true,
      justCameOnline: false,
      justWentOffline: true,
      isOnline: false,
      wasOffline: false,
      status: {
        isOnline: false,
        wasOffline: false,
      },
    });

    const { container } = render(<OfflineIndicator showWhenOffline={false} />);

    expect(container.firstChild).toBeNull();
  });
});
