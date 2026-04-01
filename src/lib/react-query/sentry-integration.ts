import * as Sentry from "@sentry/nextjs";
import type { QueryClient } from "@tanstack/react-query";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

/**
 * Configure React Query to send errors to Sentry
 * Call this when creating the QueryClient
 */
export function configureReactQuerySentryIntegration(
  queryClient: QueryClient,
): void {
  if (!isSentryEnabled) {
    return;
  }

  // Track query errors - check for updated events with error state
  queryClient.getQueryCache().subscribe((event) => {
    if (event?.type === "updated" && "query" in event) {
      const query = event.query;
      if (query.state.error && query.state.status === "error") {
        Sentry.captureException(query.state.error, {
          tags: {
            error_type: "react_query_error",
            query_key: JSON.stringify(query.queryKey),
          },
          contexts: {
            react_query: {
              query_key: query.queryKey,
              query_state: "error",
            },
          },
        });
      }
    }
  });

  // Track mutation errors - check for updated events with error state
  queryClient.getMutationCache().subscribe((event) => {
    if (event?.type === "updated" && "mutation" in event) {
      const mutation = event.mutation;
      if (mutation.state.error && mutation.state.status === "error") {
        Sentry.captureException(mutation.state.error, {
          tags: {
            error_type: "react_query_mutation_error",
            mutation_key: JSON.stringify(mutation.options.mutationKey),
          },
          contexts: {
            react_query: {
              mutation_key: mutation.options.mutationKey,
              mutation_state: "error",
            },
          },
        });
      }
    }
  });
}
