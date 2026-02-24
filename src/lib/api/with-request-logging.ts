import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import {
  getLogger,
  runWithRequestContext,
  generateRequestId,
} from "@/lib/logger";
import { getClientIP, getUserAgent } from "@/lib/utils/request-context";
import { getCurrentUserId } from "@/features/auth/utils/session";

/** Duration in ms above which a request is logged as slow (LOG-REQ-003). */
export const SLOW_REQUEST_MS = 1000;

/** Handlers may accept route context as second arg; return Response or NextResponse. */
export type RequestHandler = (
  request: NextRequest,
  ...args: unknown[]
) => Promise<NextResponse | Response> | NextResponse | Response;

/**
 * Wraps an API route handler to log request/response, set request context, and
 * report unhandled exceptions to Sentry with requestId, userId, route, environment.
 * Does not log request or response bodies (LOG-REQ-001 through LOG-REQ-004, LOG-OBS-*).
 *
 * @param handler - The actual route handler (e.g. async (request) => NextResponse)
 * @param route - Route pattern for logs and Sentry (e.g. "POST /api/rentals")
 * @returns Wrapped handler
 */
export function withRequestLogging<A extends unknown[]>(
  handler: (
    request: NextRequest,
    ...args: A
  ) => Promise<NextResponse | Response> | NextResponse | Response,
  route: string,
): (request: NextRequest, ...args: A) => Promise<NextResponse | Response> {
  return async function wrappedHandler(
    request: NextRequest,
    ...args: A
  ): Promise<NextResponse | Response> {
    const requestId =
      request.headers.get("x-request-id") ?? generateRequestId();
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    let userId: string | null = null;
    try {
      userId = await getCurrentUserId();
    } catch {
      // Leave userId null if auth fails (e.g. no session)
    }

    return runWithRequestContext(
      {
        requestId,
        userId,
        ipAddress,
        userAgent,
        route,
      },
      async () => {
        const log = getLogger();
        log.info({ method: request.method, route }, "request received");

        const start = Date.now();

        try {
          const response = await handler(request, ...args);
          const durationMs = Date.now() - start;

          log.info(
            { statusCode: response.status, durationMs, route },
            "response sent",
          );

          if (durationMs > SLOW_REQUEST_MS) {
            log.warn(
              { durationMs, route, method: request.method },
              "slow request",
            );
          }

          return response;
        } catch (error) {
          log.error({ err: error, route }, "request failed");

          Sentry.captureException(error, {
            tags: {
              requestId,
              userId: userId ?? undefined,
              route,
              environment: process.env.NODE_ENV ?? "development",
            },
          });

          throw error;
        }
      },
    );
  };
}
