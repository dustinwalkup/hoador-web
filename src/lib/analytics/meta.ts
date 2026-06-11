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
  options?: { eventID?: string },
): void {
  if (!isFbqReady()) return;
  try {
    const fbq = window.fbq as FbqFn;
    if (options?.eventID) {
      fbq(method, event, params ?? {}, { eventID: options.eventID });
    } else if (params) {
      fbq(method, event, params);
    } else {
      fbq(method, event);
    }
  } catch {
    // Pixel must never break the app.
  }
}

function track(
  event: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
): void {
  send("track", event, params, options);
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

export interface CompleteRegistrationOptions {
  /** Signup method label (e.g. "email", "google"). */
  method?: string;
  /**
   * Stable id (typically the new user id) shared with the server CAPI twin.
   * Required for dedup so iOS users with the pixel blocked don't double-count
   * when the server event fires.
   */
  eventID?: string;
}

export function trackCompleteRegistration(
  options?: CompleteRegistrationOptions,
): void {
  const params = options?.method
    ? { registration_method: options.method }
    : undefined;
  track(
    "CompleteRegistration",
    params,
    options?.eventID ? { eventID: options.eventID } : undefined,
  );
}

/**
 * Reads the Meta browser cookies for forwarding to a server CAPI event.
 * Returns `undefined` for any cookie that isn't set (e.g. ad blocker, never
 * arrived from a Facebook click). Safe to call during SSR — returns empty.
 */
export function readMetaBrowserCookies(): {
  fbp?: string;
  fbc?: string;
} {
  if (typeof document === "undefined") return {};
  const cookies = document.cookie.split("; ");
  const out: { fbp?: string; fbc?: string } = {};
  for (const c of cookies) {
    const eq = c.indexOf("=");
    if (eq < 0) continue;
    const name = c.slice(0, eq);
    if (name === "_fbp") out.fbp = decodeURIComponent(c.slice(eq + 1));
    else if (name === "_fbc") out.fbc = decodeURIComponent(c.slice(eq + 1));
  }
  return out;
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
