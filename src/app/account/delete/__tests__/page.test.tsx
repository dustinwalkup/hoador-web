import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getSession: () => mockGetSession(),
}));
// The panel has its own tests; here it only marks the signed-in branch.
vi.mock(
  "@/features/users/components/account-deletion/delete-account-panel",
  () => ({
    DeleteAccountPanel: () => <div data-testid="delete-account-panel" />,
    SUPPORT_EMAIL: "admin@hoador.com",
  }),
);

import { render, screen } from "@testing-library/react";
import DeleteAccountPage from "../page";

async function renderPage() {
  render(await DeleteAccountPage());
}

describe("/account/delete (HOA-115, Req 23.6.2)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signed out: explains deletion and links to sign-in, returning here", async () => {
    mockGetSession.mockResolvedValue(null);
    await renderPage();

    expect(
      screen.getByRole("heading", { name: /delete your hoador account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/photos you uploaded are deleted/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in to delete your account/i }),
    ).toHaveAttribute("href", "/login?callbackUrl=/account/delete");
    expect(screen.queryByTestId("delete-account-panel")).toBeNull();
  });

  it("signed in: shows the delete flow", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" }, session: {} });
    await renderPage();

    expect(screen.getByTestId("delete-account-panel")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /sign in to delete/i }),
    ).toBeNull();
  });

  it("always offers the email route for people who can't sign in", async () => {
    mockGetSession.mockResolvedValue(null);
    await renderPage();

    expect(
      screen.getByRole("link", { name: "admin@hoador.com" }),
    ).toHaveAttribute(
      "href",
      "mailto:admin@hoador.com?subject=Delete%20my%20Hoador%20account",
    );
  });
});
