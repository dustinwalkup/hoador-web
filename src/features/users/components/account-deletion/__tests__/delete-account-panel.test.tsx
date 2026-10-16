import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignOut = vi.fn(async () => undefined);
vi.mock("@/features/auth/utils", () => ({
  signOut: () => mockSignOut(),
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "@/test/utils/render-helpers";
import { DeleteAccountPanel } from "../delete-account-panel";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const RENTAL_BLOCKER = {
  type: "active_rentals",
  count: 2,
  message:
    "You have 2 active rentals. These must be completed or cancelled first.",
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** Route the two endpoints; each test overrides what it needs. */
function serve({
  blockers = [] as unknown[],
  blockersStatus = 200,
  deleteResponse = () => json({ success: true }),
}: {
  blockers?: unknown[];
  blockersStatus?: number;
  deleteResponse?: () => Promise<Response>;
} = {}) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/users/me/deletion-blockers") {
      return blockersStatus === 200
        ? json({ blockers })
        : json({ error: "nope" }, blockersStatus);
    }
    if (url === "/api/users/me" && init?.method === "DELETE") {
      return deleteResponse();
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

async function confirmAndDelete() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText(/type delete to confirm/i),
    "DELETE",
  );
  await user.click(screen.getByRole("button", { name: /delete my account/i }));
}

describe("DeleteAccountPanel (HOA-115)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists every blocker with a link, and no confirm form", async () => {
    serve({
      blockers: [
        RENTAL_BLOCKER,
        {
          type: "open_disputes",
          count: 1,
          message: "You have 1 open dispute. These must be resolved first.",
        },
      ],
    });
    renderWithQueryClient(<DeleteAccountPanel />);

    expect(
      await screen.findByText(/can't delete your account yet/i),
    ).toBeInTheDocument();
    expect(screen.getByText(RENTAL_BLOCKER.message)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /go to disputes/i }),
    ).toHaveAttribute("href", "/dashboard/disputes");
    expect(screen.queryByLabelText(/type delete to confirm/i)).toBeNull();
  });

  it("keeps the delete button disabled until DELETE is typed", async () => {
    serve();
    renderWithQueryClient(<DeleteAccountPanel />);
    const user = userEvent.setup();

    const button = await screen.findByRole("button", {
      name: /delete my account/i,
    });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/type delete to confirm/i), "DELET");
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/type delete to confirm/i), "E");
    expect(button).toBeEnabled();
  });

  it("deletes, signs the browser out, and confirms", async () => {
    serve();
    renderWithQueryClient(<DeleteAccountPanel />);

    await confirmAndDelete();

    expect(
      await screen.findByText(/your account has been deleted/i),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith("/api/users/me", {
      method: "DELETE",
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("still confirms when the browser sign-out fails: the account is gone", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("401"));
    serve();
    renderWithQueryClient(<DeleteAccountPanel />);

    await confirmAndDelete();

    expect(
      await screen.findByText(/your account has been deleted/i),
    ).toBeInTheDocument();
  });

  it("shows the fresh blockers when the delete itself is refused (409)", async () => {
    serve({
      deleteResponse: () =>
        json(
          { error: "ACCOUNT_DELETION_BLOCKED", blockers: [RENTAL_BLOCKER] },
          409,
        ),
    });
    renderWithQueryClient(<DeleteAccountPanel />);

    await confirmAndDelete();

    expect(await screen.findByText(RENTAL_BLOCKER.message)).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("shows an error, not a false success, when the delete fails", async () => {
    serve({ deleteResponse: () => json({ error: "Boom" }, 500) });
    renderWithQueryClient(<DeleteAccountPanel />);

    await confirmAndDelete();

    expect(
      await screen.findByText(/couldn't delete your account/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/has been deleted/i)).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("falls through to the confirm form when the blockers check fails", async () => {
    serve({ blockersStatus: 500 });
    renderWithQueryClient(<DeleteAccountPanel />);

    await waitFor(() =>
      expect(
        screen.getByLabelText(/type delete to confirm/i),
      ).toBeInTheDocument(),
    );
  });
});
