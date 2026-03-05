import { describe, it, expect, vi, beforeEach } from "vitest";

let mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/use-auth-mutations", () => ({
  useJoinCommunity: () => mockMutationState,
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
  Users: () => <span data-testid="users-icon" />,
  XIcon: () => <span data-testid="x-icon" />,
  CheckCircle2: () => <span data-testid="check-circle-icon" />,
  ChevronDown: () => <span data-testid="chevron-down-icon" />,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinCodeForm } from "../join-code-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";
import { SESSION_EXPIRED_MESSAGE } from "../../constants";

describe("JoinCodeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("renders label, input, button, helper text, and footer", () => {
    renderWithQueryClient(<JoinCodeForm />);

    expect(screen.getByLabelText(/community join code/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter your join code/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /join community/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /this code was provided by your community administrator/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /don't have a join code\? contact your community administrator/i,
      ),
    ).toBeInTheDocument();
  });

  it("auto-uppercases join code as user types", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<JoinCodeForm />);
    const input = screen.getByPlaceholderText(/enter your join code/i);

    await user.type(input, "abc");

    await waitFor(() => {
      expect(input).toHaveValue("ABC");
    });
  });

  it("shows validation error when submit with empty join code", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<JoinCodeForm />);
    const submitButton = screen.getByRole("button", {
      name: /join community/i,
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/join code is required/i)).toBeInTheDocument();
    });
  });

  it("calls mutateAsync with join code on submit", async () => {
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<JoinCodeForm />);
    const input = screen.getByPlaceholderText(/enter your join code/i);
    const submitButton = screen.getByRole("button", {
      name: /join community/i,
    });

    await user.type(input, "CODE1");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({
        joinCode: "CODE1",
      });
    });
  });

  it("shows pending state when isPending is true", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    };

    renderWithQueryClient(<JoinCodeForm />);

    expect(screen.getByText(/joining community\.\.\./i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /joining community/i }),
    ).toBeDisabled();
    expect(screen.getByPlaceholderText(/enter your join code/i)).toBeDisabled();
  });

  it("shows error alert when isError and error is Error instance", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("Custom message"),
    };

    renderWithQueryClient(<JoinCodeForm />);

    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });

  it("shows fallback error message when isError and error is not Error instance", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: "string error" as unknown as Error,
    };

    renderWithQueryClient(<JoinCodeForm />);

    expect(screen.getByText(/failed to join community/i)).toBeInTheDocument();
  });

  it("calls router.replace with login URL when error is SESSION_EXPIRED_MESSAGE", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error(SESSION_EXPIRED_MESSAGE),
    };

    renderWithQueryClient(<JoinCodeForm />);

    expect(mockReplace).toHaveBeenCalledWith("/login?callbackUrl=/join-code");
  });
});
