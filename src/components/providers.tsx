"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { configureReactQuerySentryIntegration } from "@/lib/react-query/sentry-integration";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { SentryUserSync } from "@/components/sentry-user-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
          refetchOnWindowFocus: false,
        },
      },
    });

    // Configure Sentry integration for React Query
    configureReactQuerySentryIntegration(client);

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SentryUserSync />
      <ServiceWorkerRegistration />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
