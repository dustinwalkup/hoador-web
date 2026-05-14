import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyMutate = vi.fn();
const mockDenyMutateAsync = vi.fn().mockResolvedValue(undefined);

let mockQueueState: {
  data:
    | {
        data: Array<{
          membership: { id: string; createdAt: string };
          community: { id: string; name: string };
          user: {
            id: string;
            firstName: string | null;
            lastName: string | null;
            email: string;
            avatarUrl: string | null;
          };
          address: {
            id: string;
            street: string;
            city: string;
            state: string;
            zipCode: string;
            country: string;
          } | null;
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

vi.mock("@/features/admin/hooks/use-admin-mutations", () => ({
  useAdminPendingVerifications: () => mockQueueState,
  useVerifyMembership: () => ({ mutate: mockVerifyMutate, isPending: false }),
  useDenyMembership: () => ({
    mutateAsync: mockDenyMutateAsync,
    isPending: false,
  }),
}));

vi.mock("lucide-react", () => ({
  Check: () => <span data-testid="check-icon" />,
  X: () => <span data-testid="x-icon" />,
  XIcon: () => <span data-testid="x-icon" />,
  ChevronLeft: () => <span data-testid="chevron-left-icon" />,
  ChevronRight: () => <span data-testid="chevron-right-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PendingVerificationsTab } from "../pending-verifications-tab";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

function makeRow(id: string, communityName: string) {
  return {
    membership: { id, createdAt: "2026-05-01T00:00:00.000Z" },
    community: { id: `c-${id}`, name: communityName },
    user: {
      id: `u-${id}`,
      firstName: "Pat",
      lastName: "Resident",
      email: `pat-${id}@example.com`,
      avatarUrl: null,
    },
    address: {
      id: `a-${id}`,
      street: "123 Main St",
      city: "Overland Park",
      state: "KS",
      zipCode: "66210",
      country: "US",
    },
  };
}

describe("PendingVerificationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueState = {
      data: {
        data: [makeRow("m1", "Foxcroft"), makeRow("m2", "Timber Trace")],
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

  it("renders a row per pending claim", () => {
    renderWithQueryClient(<PendingVerificationsTab />);
    expect(screen.getByText("Foxcroft")).toBeInTheDocument();
    expect(screen.getByText("Timber Trace")).toBeInTheDocument();
    expect(
      screen.getAllByText("123 Main St, Overland Park, KS, 66210"),
    ).toHaveLength(2);
  });

  it("verifies a row when Verify is clicked", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PendingVerificationsTab />);
    const verifyButtons = screen.getAllByRole("button", { name: /verify/i });
    await user.click(verifyButtons[0]);
    expect(mockVerifyMutate).toHaveBeenCalledWith({ membershipId: "m1" });
  });

  it("requires notes before allowing Deny to submit", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<PendingVerificationsTab />);

    await user.click(screen.getAllByRole("button", { name: /deny/i })[0]);

    const confirm = await screen.findByRole("button", { name: /^deny$/i });
    expect(confirm).toBeDisabled();

    await user.type(
      screen.getByLabelText(/reason/i),
      "Address outside community boundary",
    );
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(mockDenyMutateAsync).toHaveBeenCalledWith({
      membershipId: "m1",
      adminNotes: "Address outside community boundary",
    });
  });

  it("shows a loading spinner", () => {
    mockQueueState = { data: undefined, isLoading: true, error: null };
    renderWithQueryClient(<PendingVerificationsTab />);
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing to verify", () => {
    mockQueueState = {
      data: {
        data: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
      isLoading: false,
      error: null,
    };
    renderWithQueryClient(<PendingVerificationsTab />);
    expect(
      screen.getByText(/nothing to verify right now/i),
    ).toBeInTheDocument();
  });

  it("shows an error state", () => {
    mockQueueState = {
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    };
    renderWithQueryClient(<PendingVerificationsTab />);
    expect(
      screen.getByText(/failed to load pending verifications/i),
    ).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
