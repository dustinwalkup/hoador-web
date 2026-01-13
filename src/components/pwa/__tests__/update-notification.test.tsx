/**
 * Component tests for update-notification.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateNotification } from "../update-notification";

// Mock update-manager hook
vi.mock("@/lib/pwa/update-manager", () => ({
  useServiceWorkerUpdate: vi.fn(),
}));

// Mock install-prompt utilities
vi.mock("@/lib/pwa/install-prompt", () => ({
  isAppInstalled: vi.fn(() => true),
  isMobileDevice: vi.fn(() => true),
}));

import { useServiceWorkerUpdate } from "@/lib/pwa/update-manager";

describe("UpdateNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should not render when no update is available", () => {
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({
      updateAvailable: false,
      isInstalling: false,
      registration: null,
      checkForUpdate: vi.fn(),
      installUpdate: vi.fn(),
      state: {
        registration: null,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: false,
        error: null,
      },
    });

    const { container } = render(<UpdateNotification />);

    expect(container.firstChild).toBeNull();
  });

  it("should render when update is available", () => {
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({
      updateAvailable: true,
      isInstalling: false,
      registration: {} as ServiceWorkerRegistration,
      checkForUpdate: vi.fn(),
      installUpdate: vi.fn(),
      state: {
        registration: {} as ServiceWorkerRegistration,
        updateAvailable: true,
        installing: false,
        waiting: true,
        active: false,
        error: null,
      },
    });

    render(<UpdateNotification />);

    expect(screen.getByText(/Update Available/i)).toBeInTheDocument();
    // Find Update button specifically (not dismiss button)
    const buttons = screen.getAllByRole("button");
    const updateButton = buttons.find(
      (button) =>
        button.textContent?.trim() === "Update" ||
        button.textContent?.includes("Update"),
    );
    expect(updateButton).toBeInTheDocument();
  });

  it("should call installUpdate when update button is clicked", async () => {
    const user = userEvent.setup();
    const installUpdate = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useServiceWorkerUpdate).mockReturnValue({
      updateAvailable: true,
      isInstalling: false,
      registration: {} as ServiceWorkerRegistration,
      checkForUpdate: vi.fn(),
      installUpdate,
      state: {
        registration: {} as ServiceWorkerRegistration,
        updateAvailable: true,
        installing: false,
        waiting: true,
        active: false,
        error: null,
      },
    });

    render(<UpdateNotification />);

    // Use getAllByRole and filter to get the Update button (not the dismiss button)
    const buttons = screen.getAllByRole("button");
    const updateButton = buttons.find((button) =>
      button.textContent?.includes("Update"),
    );
    expect(updateButton).toBeInTheDocument();
    await user.click(updateButton!);

    expect(installUpdate).toHaveBeenCalled();
  });

  it("should show installing state", () => {
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({
      updateAvailable: true,
      isInstalling: true,
      registration: {} as ServiceWorkerRegistration,
      checkForUpdate: vi.fn(),
      installUpdate: vi.fn(),
      state: {
        registration: {} as ServiceWorkerRegistration,
        updateAvailable: true,
        installing: true,
        waiting: true,
        active: false,
        error: null,
      },
    });

    render(<UpdateNotification />);

    expect(screen.getByText(/Updating.../i)).toBeInTheDocument();
  });
});
