import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ServiceListingForm } from "../service-listing-form";
import {
  myServiceListingsKeys,
  serviceListingsKeys,
} from "../../hooks/use-service-listings";
import type { ServiceListing } from "@/db/schemas/services.schema";

// router.push is used post-submit; capture it so navigation doesn't throw.
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

// Minimal edit-mode initial values that satisfy the form schema so submit
// reaches the success path (PATCH ok → cache invalidation).
const editInitial: Partial<ServiceListing> = {
  title: "Lawn mowing",
  description: "I mow lawns carefully and on schedule.",
  price: "50",
  pricingType: "fixed",
  ownerPoliciesAcknowledged: true,
  status: "active",
};

describe("ServiceListingForm — cache invalidation on save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "listing-1" }) });
  });

  it("invalidates the listings query caches after a successful edit (instead of router.refresh)", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <ServiceListingForm
          mode="edit"
          listingId="listing-1"
          communityId="community-1"
          categories={[{ id: "cat-1", name: "Lawn & Yard" }]}
          initial={editInitial}
        />
      </QueryClientProvider>,
    );

    // Save is disabled until the edit form is dirty — change the title.
    const title = screen.getByPlaceholderText(
      /Lawn mowing, furniture assembly/i,
    );
    await user.type(title, " (updated)");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/services/listings/listing-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: myServiceListingsKeys.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: serviceListingsKeys.all,
      });
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/listings/services");
  });
});
