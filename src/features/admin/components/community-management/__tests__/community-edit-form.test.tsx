import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateAsync = vi.fn().mockResolvedValue({ id: "new" });
const mockUpdateAsync = vi.fn().mockResolvedValue({ id: "c1" });
let mockCreateState: {
  mutateAsync: typeof mockCreateAsync;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};
let mockUpdateState: {
  mutateAsync: typeof mockUpdateAsync;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

vi.mock("@/features/admin/hooks/use-admin-communities", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/hooks/use-admin-communities")
  >("@/features/admin/hooks/use-admin-communities");
  return {
    ...actual,
    useAdminNetworks: () => ({
      data: [
        { id: "net-kc", name: "Kansas City Metro" },
        { id: "net-test", name: "Test Network" },
      ],
    }),
    useCreateCommunity: () => mockCreateState,
    useUpdateCommunity: () => mockUpdateState,
  };
});

vi.mock("lucide-react", () => ({
  CheckIcon: () => <span data-testid="check-icon" />,
  ChevronDownIcon: () => <span data-testid="chevron-down-icon" />,
  ChevronUpIcon: () => <span data-testid="chevron-up-icon" />,
  XIcon: () => <span data-testid="x-icon" />,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityEditForm } from "../community-edit-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

describe("CommunityEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateState = {
      mutateAsync: mockCreateAsync,
      isPending: false,
      isError: false,
      error: null,
    };
    mockUpdateState = {
      mutateAsync: mockUpdateAsync,
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("creates a community with trimmed values and a null network when none picked", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderWithQueryClient(<CommunityEditForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/^name$/i), "  Foxcroft  ");
    await user.type(screen.getByLabelText(/^city$/i), "Overland Park");

    await user.click(screen.getByRole("button", { name: /create community/i }));

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Foxcroft",
          city: "Overland Park",
          isActive: true,
          networkId: null,
          address: null,
          latitude: null,
        }),
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("disables submit until a name is entered", () => {
    renderWithQueryClient(<CommunityEditForm />);
    expect(
      screen.getByRole("button", { name: /create community/i }),
    ).toBeDisabled();
  });

  it("pre-fills fields when editing and updates via the update hook", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <CommunityEditForm
        community={
          {
            id: "c1",
            name: "Timber Trace",
            imageUrl: null,
            address: "1 Pine Rd",
            city: "Lenexa",
            state: "KS",
            zip: "66215",
            latitude: "38.95",
            longitude: "-94.78",
            isActive: true,
            networkId: "net-kc",
          } as never
        }
      />,
    );

    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Timber Trace");
    expect(screen.getByLabelText(/^city$/i)).toHaveValue("Lenexa");

    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "Timber Trace North");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAsync).toHaveBeenCalledWith({
        id: "c1",
        values: expect.objectContaining({
          name: "Timber Trace North",
          networkId: "net-kc",
        }),
      });
    });
  });

  it("shows the mutation error", () => {
    mockCreateState = {
      mutateAsync: mockCreateAsync,
      isPending: false,
      isError: true,
      error: new Error("Name already taken"),
    };
    renderWithQueryClient(<CommunityEditForm />);
    expect(screen.getByText("Name already taken")).toBeInTheDocument();
  });
});
