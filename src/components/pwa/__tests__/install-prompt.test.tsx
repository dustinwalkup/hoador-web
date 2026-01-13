/**
 * Component tests for install-prompt.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallPrompt } from "../install-prompt";

// Mock use-install-prompt hook
vi.mock("@/lib/pwa/use-install-prompt", () => ({
  useInstallPrompt: vi.fn(),
}));

// Mock use-mobile hook
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => true),
}));

import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

describe("InstallPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when not installable", () => {
    vi.mocked(useInstallPrompt).mockReturnValue({
      state: {
        deferredPrompt: null,
        isInstallable: false,
        isInstalled: false,
        userChoice: null,
      },
      isSupported: true,
      isInstallable: false,
      isInstalled: false,
      isDismissed: false,
      showPrompt: vi.fn(),
      dismiss: vi.fn(),
      remindLater: vi.fn(),
      clearDismissed: vi.fn(),
      isInstalling: false,
      error: null,
    });

    const { container } = render(<InstallPrompt />);

    expect(container.firstChild).toBeNull();
  });

  it("should not render when already installed", () => {
    vi.mocked(useInstallPrompt).mockReturnValue({
      state: {
        deferredPrompt: null,
        isInstallable: true,
        isInstalled: true,
        userChoice: null,
      },
      isSupported: true,
      isInstallable: true,
      isInstalled: true,
      isDismissed: false,
      showPrompt: vi.fn(),
      dismiss: vi.fn(),
      remindLater: vi.fn(),
      clearDismissed: vi.fn(),
      isInstalling: false,
      error: null,
    });

    const { container } = render(<InstallPrompt />);

    expect(container.firstChild).toBeNull();
  });

  it("should render when installable", () => {
    vi.mocked(useInstallPrompt).mockReturnValue({
      state: {
        deferredPrompt: null,
        isInstallable: true,
        isInstalled: false,
        userChoice: null,
      },
      isSupported: true,
      isInstallable: true,
      isInstalled: false,
      isDismissed: false,
      showPrompt: vi.fn(),
      dismiss: vi.fn(),
      remindLater: vi.fn(),
      clearDismissed: vi.fn(),
      isInstalling: false,
      error: null,
    });

    render(<InstallPrompt />);

    expect(screen.getByText(/Install Hoador/i)).toBeInTheDocument();
    // Find Install button specifically (not dismiss button which has "install" in aria-label)
    const buttons = screen.getAllByRole("button");
    const installButton = buttons.find(
      (button) => button.textContent?.trim() === "Install",
    );
    expect(installButton).toBeInTheDocument();
  });

  it("should call showPrompt when install button is clicked", async () => {
    const user = userEvent.setup();
    const showPrompt = vi.fn().mockResolvedValue({
      outcome: "accepted" as const,
      platform: "web",
    });

    vi.mocked(useInstallPrompt).mockReturnValue({
      state: {
        deferredPrompt: null,
        isInstallable: true,
        isInstalled: false,
        userChoice: null,
      },
      isSupported: true,
      isInstallable: true,
      isInstalled: false,
      isDismissed: false,
      showPrompt,
      dismiss: vi.fn(),
      remindLater: vi.fn(),
      clearDismissed: vi.fn(),
      isInstalling: false,
      error: null,
    });

    render(<InstallPrompt />);

    // Find Install button specifically (not dismiss button which has "install" in aria-label)
    const buttons = screen.getAllByRole("button");
    const installButton = buttons.find(
      (button) => button.textContent?.trim() === "Install",
    );
    expect(installButton).toBeInTheDocument();
    await user.click(installButton!);

    expect(showPrompt).toHaveBeenCalled();
  });

  it("should call dismiss when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const dismiss = vi.fn();

    vi.mocked(useInstallPrompt).mockReturnValue({
      state: {
        deferredPrompt: null,
        isInstallable: true,
        isInstalled: false,
        userChoice: null,
      },
      isSupported: true,
      isInstallable: true,
      isInstalled: false,
      isDismissed: false,
      showPrompt: vi.fn(),
      dismiss,
      remindLater: vi.fn(),
      clearDismissed: vi.fn(),
      isInstalling: false,
      error: null,
    });

    render(<InstallPrompt />);

    // The "Never" button calls dismiss() - find it by text or aria-label
    const dismissButton = screen.getByRole("button", {
      name: /Never show install prompt/i,
    });
    await user.click(dismissButton);

    // Wait for the setTimeout in handleNever to complete (300ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(dismiss).toHaveBeenCalled();
  });

  it("should show installing state", () => {
    vi.mocked(useInstallPrompt).mockReturnValue({
      state: {
        deferredPrompt: null,
        isInstallable: true,
        isInstalled: false,
        userChoice: null,
      },
      isSupported: true,
      isInstallable: true,
      isInstalled: false,
      isDismissed: false,
      showPrompt: vi.fn(),
      dismiss: vi.fn(),
      remindLater: vi.fn(),
      clearDismissed: vi.fn(),
      isInstalling: true,
      error: null,
    });

    render(<InstallPrompt />);

    expect(screen.getByText(/Installing.../i)).toBeInTheDocument();
  });
});
