import { describe, it, expect, vi, beforeEach } from "vitest";

let mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

let mockCommunitiesQuery = {
  data: [
    { id: "c-foxcroft", name: "Foxcroft", city: "Kansas City", state: "MO" },
    { id: "c-timber", name: "Timber Trace", city: "Kansas City", state: "MO" },
    { id: "c-pembroke", name: "Pembroke Court", city: "Leawood", state: "KS" },
  ] as Array<{ id: string; name: string; city?: string; state?: string }>,
  isLoading: false,
  isError: false,
};

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/use-auth-mutations", () => ({
  useSelectCommunity: () => mockMutationState,
}));

vi.mock("@/features/community/hooks/use-communities", () => ({
  useCommunitiesByNetwork: () => mockCommunitiesQuery,
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
  ArrowRight: () => <span data-testid="arrow-right-icon" />,
  // RequestHoadorModal pulls in extra icons; stub them defensively.
  XIcon: () => <span data-testid="x-icon" />,
  CheckCircle2: () => <span data-testid="check-circle-icon" />,
  ChevronDown: () => <span data-testid="chevron-down-icon" />,
  ChevronDownIcon: () => <span data-testid="chevron-down-icon" />,
  ChevronUpIcon: () => <span data-testid="chevron-up-icon" />,
  CheckIcon: () => <span data-testid="check-icon" />,
  ChevronsUpDownIcon: () => <span data-testid="chevrons-up-down-icon" />,
  SearchIcon: () => <span data-testid="search-icon" />,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunitySelectForm } from "../community-select-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";
import { SESSION_EXPIRED_MESSAGE } from "../../constants";

describe("CommunitySelectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isError: false,
      error: null,
    };
    mockCommunitiesQuery = {
      data: [
        {
          id: "c-foxcroft",
          name: "Foxcroft",
          city: "Kansas City",
          state: "MO",
        },
        {
          id: "c-timber",
          name: "Timber Trace",
          city: "Kansas City",
          state: "MO",
        },
        {
          id: "c-pembroke",
          name: "Pembroke Court",
          city: "Leawood",
          state: "KS",
        },
      ],
      isLoading: false,
      isError: false,
    };
  });

  it("renders the select, continue button, request modal trigger, and join-code link", () => {
    renderWithQueryClient(<CommunitySelectForm />);

    expect(screen.getByLabelText(/select your community/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request your community/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /enter it here/i }),
    ).toHaveAttribute("href", "/join-code");
  });

  it("disables Continue until a community is selected", () => {
    renderWithQueryClient(<CommunitySelectForm />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("populates options from the communities query", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitySelectForm />);

    await user.click(screen.getByLabelText(/select your community/i));

    expect(
      await screen.findByRole("option", { name: /foxcroft/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /timber trace/i }),
    ).toBeInTheDocument();
  });

  it("groups communities under city/state headings, alphabetized within and across groups", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitySelectForm />);

    await user.click(screen.getByLabelText(/select your community/i));

    // Each location renders once, as a group heading.
    expect(await screen.findByText("Kansas City, MO")).toBeInTheDocument();
    expect(screen.getByText("Leawood, KS")).toBeInTheDocument();

    // Groups are ordered alphabetically by heading (Kansas City → Leawood) and
    // items are alphabetized within each group (Foxcroft → Timber Trace).
    const optionNames = screen
      .getAllByRole("option")
      .map((el) => el.textContent);
    expect(optionNames).toEqual(["Foxcroft", "Timber Trace", "Pembroke Court"]);
  });

  it("filters communities when typing in the search input", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitySelectForm />);

    await user.click(screen.getByLabelText(/select your community/i));
    await user.type(
      await screen.findByPlaceholderText(/search communities/i),
      "timber",
    );

    expect(
      await screen.findByRole("option", { name: /timber trace/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /foxcroft/i }),
    ).not.toBeInTheDocument();
  });

  it("matches search against city and state", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitySelectForm />);

    await user.click(screen.getByLabelText(/select your community/i));
    await user.type(
      await screen.findByPlaceholderText(/search communities/i),
      "leawood",
    );

    expect(
      await screen.findByRole("option", { name: /pembroke court/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /foxcroft/i }),
    ).not.toBeInTheDocument();
  });

  it("submits the selected community id", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CommunitySelectForm />);

    await user.click(screen.getByLabelText(/select your community/i));
    await user.click(await screen.findByRole("option", { name: /foxcroft/i }));

    const submit = screen.getByRole("button", { name: /continue/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({
        communityId: "c-foxcroft",
      });
    });
  });

  it("shows a loading placeholder while communities load", () => {
    mockCommunitiesQuery = {
      data: undefined as never,
      isLoading: true,
      isError: false,
    };
    renderWithQueryClient(<CommunitySelectForm />);
    expect(screen.getByText(/loading communities/i)).toBeInTheDocument();
  });

  it("shows an error alert when the communities query fails", () => {
    mockCommunitiesQuery = {
      data: undefined as never,
      isLoading: false,
      isError: true,
    };
    renderWithQueryClient(<CommunitySelectForm />);
    expect(
      screen.getByText(/couldn't load the list of communities/i),
    ).toBeInTheDocument();
  });

  it("shows the mutation error message", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("You already belong to a community"),
    };
    renderWithQueryClient(<CommunitySelectForm />);
    expect(
      screen.getByText("You already belong to a community"),
    ).toBeInTheDocument();
  });

  it("redirects to login when the session has expired", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error(SESSION_EXPIRED_MESSAGE),
    };
    renderWithQueryClient(<CommunitySelectForm />);
    expect(mockReplace).toHaveBeenCalledWith(
      "/login?callbackUrl=/community-select",
    );
  });
});
