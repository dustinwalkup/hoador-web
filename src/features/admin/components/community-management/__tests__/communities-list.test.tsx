import { describe, it, expect, vi, beforeEach } from "vitest";

let mockListState: {
  data:
    | {
        data: Array<{
          id: string;
          name: string;
          city: string | null;
          state: string | null;
          isActive: boolean;
          memberCount?: number;
        }>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      }
    | undefined;
  isLoading: boolean;
  error: Error | null;
};

vi.mock("@/features/admin/hooks/use-admin-communities", () => ({
  useAdminCommunities: () => mockListState,
  useAdminNetworks: () => ({ data: [] }),
  useCreateCommunity: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useUpdateCommunity: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="plus-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  ChevronLeft: () => <span data-testid="chevron-left-icon" />,
  ChevronRight: () => <span data-testid="chevron-right-icon" />,
  CheckIcon: () => <span data-testid="check-icon" />,
  ChevronDownIcon: () => <span data-testid="chevron-down-icon" />,
  ChevronUpIcon: () => <span data-testid="chevron-up-icon" />,
  XIcon: () => <span data-testid="x-icon" />,
}));

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunitiesList } from "../communities-list";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

describe("CommunitiesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListState = {
      data: {
        data: [
          {
            id: "c1",
            name: "Foxcroft",
            city: "Overland Park",
            state: "KS",
            isActive: true,
            memberCount: 12,
          },
          {
            id: "c2",
            name: "Timber Trace",
            city: "Lenexa",
            state: "KS",
            isActive: false,
            memberCount: 0,
          },
        ],
        pagination: {
          page: 1,
          limit: 25,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
      isLoading: false,
      error: null,
    };
  });

  it("renders a row per community with status", () => {
    renderWithQueryClient(<CommunitiesList />);
    expect(screen.getByText("Foxcroft")).toBeInTheDocument();
    expect(screen.getByText("Timber Trace")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("opens the new-community dialog", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitiesList />);
    await user.click(screen.getByRole("button", { name: /new community/i }));
    expect(
      screen.getByRole("dialog", { name: /new community/i }),
    ).toBeInTheDocument();
  });

  it("opens the edit dialog for a row", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitiesList />);
    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);
    expect(
      screen.getByRole("dialog", { name: /edit community/i }),
    ).toBeInTheDocument();
  });

  it("shows a loading spinner", () => {
    mockListState = { data: undefined, isLoading: true, error: null };
    renderWithQueryClient(<CommunitiesList />);
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  it("shows an error state", () => {
    mockListState = {
      data: undefined,
      isLoading: false,
      error: new Error("nope"),
    };
    renderWithQueryClient(<CommunitiesList />);
    expect(screen.getByText(/failed to load communities/i)).toBeInTheDocument();
  });
});
