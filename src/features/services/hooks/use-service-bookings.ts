import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import type { ServiceBookingDetailResponse } from "@/app/api/services/bookings/[id]/route";
import type { CreateBookingInput } from "@/features/services/types";

/** React Query keys for HOA service bookings. */
export const serviceBookingsKeys = {
  all: ["service-bookings"] as const,
  list: (role: "requester" | "provider") =>
    [...serviceBookingsKeys.all, "list", role] as const,
  detail: (bookingId: string) =>
    [...serviceBookingsKeys.all, "detail", bookingId] as const,
};

/**
 * Dashboard booking list for the signed-in user as requester or provider.
 */
export function useServiceBookings(role: "requester" | "provider" | null) {
  return useQuery({
    queryKey:
      role === "requester" || role === "provider"
        ? serviceBookingsKeys.list(role)
        : [...serviceBookingsKeys.all, "list", "idle"],
    queryFn: async (): Promise<ServiceBookingDashboardRow[]> => {
      const res = await fetch(
        `/api/services/bookings?role=${encodeURIComponent(role!)}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load bookings");
      }
      const data = (await res.json()) as {
        bookings: ServiceBookingDashboardRow[];
      };
      return data.bookings ?? [];
    },
    enabled: role === "requester" || role === "provider",
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Booking detail when the viewer is the requester or provider.
 *
 * Typed against `ServiceBookingDetailResponse` — the route's own wire type —
 * rather than `ServiceBookingWithDetails`, the DAL row. Those stopped being the
 * same thing when the route was narrowed (mobile P-E9-3): it no longer emits
 * Stripe identifiers or either party's email, and it adds `viewerRole`,
 * `cancelledByRole` and a provider-only `earnings`. A type-only import, so no
 * server module reaches the client bundle.
 *
 * **This hook currently has no callers** — `/dashboard/services/bookings/[id]`
 * is a server component that reads the DAL directly. It is typed correctly
 * anyway, because a hook that compiles against a shape the endpoint stopped
 * returning is a trap for whoever calls it first.
 */
export function useServiceBooking(bookingId: string | null | undefined) {
  return useQuery({
    queryKey: serviceBookingsKeys.detail(bookingId ?? ""),
    queryFn: async (): Promise<ServiceBookingDetailResponse> => {
      const res = await fetch(`/api/services/bookings/${bookingId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load booking");
      }
      return res.json() as Promise<ServiceBookingDetailResponse>;
    },
    enabled: Boolean(bookingId),
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * POST /api/services/bookings — request a booking.
 */
export function useCreateServiceBooking() {
  return useCreateMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const res = await fetch("/api/services/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create booking");
      }
      return data as { bookingId: string; status: string };
    },
    invalidateQueryKeys: [serviceBookingsKeys.all],
    successMessage: "Booking request sent.",
  });
}

/**
 * POST /api/services/bookings/[id]/accept
 */
export function useAcceptServiceBooking(bookingId: string) {
  return useCreateMutation<{ status: string }, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/services/bookings/${bookingId}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorObj = new Error(data.error ?? "Failed to accept booking");
        if (res.status === 403 && data.error === "PAYMENT_SETUP_REQUIRED") {
          // Caller (UI) redirects to JIT onboarding; suppress the auto-toast
          // so the user doesn't see a flash of error before the navigation.
          Object.assign(errorObj, {
            code: "PAYMENT_SETUP_REQUIRED",
            onboardingStatus: data.onboardingStatus,
            suppressToast: true,
          });
        }
        throw errorObj;
      }
      return data as { status: string };
    },
    invalidateQueryKeys: [serviceBookingsKeys.all],
    successMessage: "Booking accepted and payment processed.",
  });
}

/**
 * POST /api/services/bookings/[id]/decline
 */
export function useDeclineServiceBooking(bookingId: string) {
  return useCreateMutation({
    mutationFn: async (variables: { reason: string }) => {
      const res = await fetch(`/api/services/bookings/${bookingId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to decline booking");
      }
      return data;
    },
    invalidateQueryKeys: [serviceBookingsKeys.all],
    successMessage: "Booking declined.",
  });
}

/**
 * POST /api/services/bookings/[id]/complete
 */
export function useCompleteServiceBooking(bookingId: string) {
  return useCreateMutation<{ status: string }, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/services/bookings/${bookingId}/complete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to complete booking");
      }
      return data as { status: string };
    },
    invalidateQueryKeys: [serviceBookingsKeys.all],
    successMessage: "Marked complete.",
  });
}

/**
 * POST /api/services/bookings/[id]/cancel
 */
export function useCancelServiceBooking(bookingId: string) {
  return useCreateMutation({
    mutationFn: async (variables?: { reason?: string }) => {
      const res = await fetch(`/api/services/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to cancel booking");
      }
      return data;
    },
    invalidateQueryKeys: [serviceBookingsKeys.all],
    successMessage: "Booking cancelled.",
  });
}
