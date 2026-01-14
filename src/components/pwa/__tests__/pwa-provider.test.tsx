/**
 * Component tests for pwa-provider.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { PWAProvider } from "../pwa-provider";

// Mock hooks
vi.mock("@/lib/pwa/use-service-worker", () => ({
  useServiceWorker: vi.fn(),
}));

vi.mock("@/lib/pwa/install-prompt", () => ({
  initializeInstallPrompt: vi.fn(),
}));

vi.mock("@/lib/pwa/network-status", () => ({
  useNetworkStatus: vi.fn(),
}));

vi.mock("@/lib/pwa/offline-queue", () => ({
  hasQueuedActions: vi.fn(() => false),
  getQueuedActionCount: vi.fn(() => 0),
}));

import { useServiceWorker } from "@/lib/pwa/use-service-worker";
import { useNetworkStatus } from "@/lib/pwa/network-status";

describe("PWAProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    vi.mocked(useServiceWorker).mockReturnValue({
      state: {
        registration: null,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: false,
        error: null,
      },
      isSupported: true,
      canRegister: true,
      register: vi.fn(),
      checkForUpdates: vi.fn(),
      reloadClients: vi.fn(),
      isRegistering: false,
    });

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

    const { container } = render(
      <PWAProvider>
        <div data-testid="child">Test Content</div>
      </PWAProvider>,
    );

    expect(
      container.querySelector('[data-testid="child"]'),
    ).toBeInTheDocument();
  });

  it("should initialize install prompt on mount", () => {
    vi.mocked(useServiceWorker).mockReturnValue({
      state: {
        registration: null,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: false,
        error: null,
      },
      isSupported: true,
      canRegister: true,
      register: vi.fn(),
      checkForUpdates: vi.fn(),
      reloadClients: vi.fn(),
      isRegistering: false,
    });

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

    render(<PWAProvider />);
  });
});
