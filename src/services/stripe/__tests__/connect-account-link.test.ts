import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Requirements: 2.3.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.4
 */

const mockAccountLinksCreate = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    accountLinks: {
      create: (...args: unknown[]) => mockAccountLinksCreate(...args),
    },
  },
}));

import { createAccountLink } from "../connect";

describe("createAccountLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const urls = {
    return_url: "https://hoador.com/mobile/connect-return",
    refresh_url: "https://hoador.com/mobile/connect-refresh",
  };

  it("creates an account_onboarding link for the account and returns its URL", async () => {
    mockAccountLinksCreate.mockResolvedValue({
      url: "https://connect.stripe.com/setup/e/acct_1/abc",
    });

    const url = await createAccountLink("acct_1", urls);

    expect(url).toBe("https://connect.stripe.com/setup/e/acct_1/abc");
    expect(mockAccountLinksCreate).toHaveBeenCalledWith({
      account: "acct_1",
      type: "account_onboarding",
      return_url: urls.return_url,
      refresh_url: urls.refresh_url,
    });
  });

  it("propagates a Stripe error", async () => {
    mockAccountLinksCreate.mockRejectedValue(new Error("invalid account"));

    await expect(createAccountLink("acct_1", urls)).rejects.toThrow(
      "invalid account",
    );
  });

  it("throws when Stripe returns no URL", async () => {
    mockAccountLinksCreate.mockResolvedValue({ url: null });

    await expect(createAccountLink("acct_1", urls)).rejects.toThrow(
      "no URL returned",
    );
  });
});
