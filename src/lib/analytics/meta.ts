/**
 * Meta (Facebook) Pixel browser tracking helpers.
 *
 * Safe to import from server components — every helper short-circuits when
 * `window`/`fbq` is unavailable, so SSR will never throw.
 *
 * Server-side events are sent via the Conversions API in
 * `src/lib/integrations/meta/meta-capi.ts`. The Purchase event is server-only:
 * money moves when the owner approves the request (the renter has no browser
 * session at that moment), so the approval flow sends it via CAPI and there is
 * no browser counterpart to dedupe against. The browser fires the custom
 * `RentalRequested` event at request submission instead — see
 * {@link trackRentalRequested}.
 */

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: FbqFn;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

function isFbqReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function send(
  method: "track" | "trackCustom",
  event: string,
  params?: Record<string, unknown>,
): void {
  if (!isFbqReady()) return;
  try {
    const fbq = window.fbq as FbqFn;
    if (params) {
      fbq(method, event, params);
    } else {
      fbq(method, event);
    }
  } catch {
    // Pixel must never break the app.
  }
}

function track(event: string, params?: Record<string, unknown>): void {
  send("track", event, params);
}

function trackCustom(event: string, params?: Record<string, unknown>): void {
  send("trackCustom", event, params);
}

export function trackPageView(): void {
  track("PageView");
}

export interface ViewContentPayload {
  contentId: string;
  contentName: string;
  contentType?: string;
}

export function trackViewContent(payload: ViewContentPayload): void {
  track("ViewContent", {
    content_name: payload.contentName,
    content_type: payload.contentType ?? "product",
    content_ids: [payload.contentId],
  });
}

export function trackSearch(query: string): void {
  if (!query.trim()) return;
  track("Search", { search_string: query });
}

export function trackCompleteRegistration(method?: string): void {
  track(
    "CompleteRegistration",
    method ? { registration_method: method } : undefined,
  );
}

export interface InitiateCheckoutPayload {
  value: number;
  currency?: string;
  contentIds?: string[];
}

export function trackInitiateCheckout(payload: InitiateCheckoutPayload): void {
  const params: Record<string, unknown> = {
    value: payload.value,
    currency: payload.currency ?? "USD",
  };
  if (payload.contentIds?.length) {
    params.content_ids = payload.contentIds;
    params.content_type = "product";
  }
  track("InitiateCheckout", params);
}

export interface RentalRequestedPayload {
  value: number;
  currency?: string;
  contentIds?: string[];
}

/**
 * Custom event fired when the renter submits a rental request.
 *
 * Deliberately NOT a `Purchase`: no money moves until the owner approves the
 * request, which can happen days later (or never). The canonical Purchase is
 * sent server-side via the Conversions API from the approval flow — see
 * `sendMetaPurchase` in `src/lib/integrations/meta/meta-capi.ts`.
 */
export function trackRentalRequested(payload: RentalRequestedPayload): void {
  const params: Record<string, unknown> = {
    value: payload.value,
    currency: payload.currency ?? "USD",
  };
  if (payload.contentIds?.length) {
    params.content_ids = payload.contentIds;
    params.content_type = "product";
  }
  trackCustom("RentalRequested", params);
}
