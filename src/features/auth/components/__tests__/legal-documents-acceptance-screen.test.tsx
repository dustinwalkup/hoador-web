import { describe, it, expect, vi, beforeEach } from "vitest";

let mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

vi.mock("../../hooks/use-auth-mutations", () => ({
  useAcceptLegalDocuments: () => mockMutationState,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
    />
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LegalDocumentsAcceptanceScreen } from "../legal-documents-acceptance-screen";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

const defaultProps = {
  firstName: "Jane",
  documentUrls: { tos: "/terms", privacy: "/privacy" },
};

describe("LegalDocumentsAcceptanceScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("renders welcome message, copy, checkbox label, links, and submit button", () => {
    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);

    expect(screen.getByText("Welcome, Jane!")).toBeInTheDocument();
    expect(
      screen.getByText(/before continuing, please acknowledge the following/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: /i agree to the terms of service and privacy policy/i,
      }),
    ).toBeInTheDocument();
    const tosLink = screen.getByRole("link", { name: /terms of service/i });
    const privacyLink = screen.getByRole("link", { name: /privacy policy/i });
    expect(tosLink).toHaveAttribute("href", "/terms");
    expect(privacyLink).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).toBeInTheDocument();
  });

  it("submit button is disabled when checkbox is unchecked", () => {
    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("submit button becomes enabled when checkbox is checked", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /i agree to the terms of service and privacy policy/i,
    });

    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    });
  });

  it("calls mutateAsync with tosAccepted and privacyAccepted when submit", async () => {
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /i agree to the terms of service and privacy policy/i,
    });
    const submitButton = screen.getByRole("button", { name: /continue/i });

    await user.click(checkbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({
        tosAccepted: true,
        privacyAccepted: true,
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

    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);

    expect(screen.getByText(/processing\.\.\./i)).toBeInTheDocument();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows error alert when isError and error is Error instance", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("Acceptance failed"),
    };

    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);

    expect(screen.getByText("Acceptance failed")).toBeInTheDocument();
  });

  it("shows fallback error message when isError and error is not Error instance", () => {
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: "string error" as unknown as Error,
    };

    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);

    expect(
      screen.getByText(/failed to accept legal documents/i),
    ).toBeInTheDocument();
  });

  it("does not call mutateAsync when form is submitted with checkbox unchecked", () => {
    renderWithQueryClient(<LegalDocumentsAcceptanceScreen {...defaultProps} />);

    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    form?.requestSubmit();

    expect(mockMutationState.mutateAsync).not.toHaveBeenCalled();
  });
});
