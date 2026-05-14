import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMutate = vi.fn();
let mockVisibilityState: {
  data: Array<{
    community: { id: string; name: string };
    isVisible: boolean;
    isPrimary: boolean;
  }>;
  isLoading: boolean;
  isError: boolean;
};
let mockUpdateState: {
  mutate: typeof mockMutate;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

vi.mock("@/features/users/hooks/use-visibility", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/users/hooks/use-visibility")
  >("@/features/users/hooks/use-visibility");
  return {
    ...actual,
    useVisibility: () => mockVisibilityState,
    useUpdateVisibility: () => mockUpdateState,
  };
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisibilitySettingsCard } from "../visibility-settings-card";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

describe("VisibilitySettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisibilityState = {
      data: [
        {
          community: { id: "c-home", name: "Foxcroft" },
          isVisible: true,
          isPrimary: true,
        },
        {
          community: { id: "c-2", name: "Glen Arbor Estates" },
          isVisible: true,
          isPrimary: false,
        },
        {
          community: { id: "c-3", name: "Timber Trace" },
          isVisible: false,
          isPrimary: false,
        },
      ],
      isLoading: false,
      isError: false,
    };
    mockUpdateState = {
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("renders a row per community", () => {
    renderWithQueryClient(<VisibilitySettingsCard />);
    expect(screen.getByText("Foxcroft")).toBeInTheDocument();
    expect(screen.getByText("Glen Arbor Estates")).toBeInTheDocument();
    expect(screen.getByText("Timber Trace")).toBeInTheDocument();
  });

  it("locks the primary community with helper copy", () => {
    renderWithQueryClient(<VisibilitySettingsCard />);
    expect(
      screen.getByText(/home community — always visible/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /visible in foxcroft/i }),
    ).toBeDisabled();
  });

  it("keeps Save disabled until something changes", () => {
    renderWithQueryClient(<VisibilitySettingsCard />);
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeDisabled();
  });

  it("enables Save and submits only the diff", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<VisibilitySettingsCard />);

    // Turn Timber Trace on (was off).
    await user.click(
      screen.getByRole("switch", { name: /visible in timber trace/i }),
    );

    const save = screen.getByRole("button", { name: /save changes/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(mockMutate).toHaveBeenCalledWith(
      [{ communityId: "c-3", isVisible: true }],
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows the mutation error message", () => {
    mockUpdateState = {
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: new Error("Cannot hide your home community"),
    };
    renderWithQueryClient(<VisibilitySettingsCard />);
    expect(
      screen.getByText("Cannot hide your home community"),
    ).toBeInTheDocument();
  });

  it("renders a loading skeleton", () => {
    mockVisibilityState = {
      data: undefined as never,
      isLoading: true,
      isError: false,
    };
    const { container } = renderWithQueryClient(<VisibilitySettingsCard />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
  });

  it("renders an error alert when the query fails", () => {
    mockVisibilityState = {
      data: undefined as never,
      isLoading: false,
      isError: true,
    };
    renderWithQueryClient(<VisibilitySettingsCard />);
    expect(
      screen.getByText(/couldn't load your visibility settings/i),
    ).toBeInTheDocument();
  });
});
