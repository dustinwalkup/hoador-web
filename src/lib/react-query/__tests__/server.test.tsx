import { describe, it, expect } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  HydrationBoundary,
  dehydrate,
  useQuery,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { getServerQueryClient } from "../server";

describe("getServerQueryClient", () => {
  it("returns a QueryClient with staleTime matching client providers (≥ client query staleTime)", () => {
    const qc = getServerQueryClient();
    const defaults = qc.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(5 * 60 * 1000);
    expect(defaults?.gcTime).toBe(10 * 60 * 1000);
  });

  it("dehydrated prefetched query hydrates as fresh (no refetch) on the client", async () => {
    const server = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60 * 1000 },
      },
    });

    const queryKey = ["test", "hydration"];
    let serverFetches = 0;
    await server.prefetchQuery({
      queryKey,
      queryFn: async () => {
        serverFetches++;
        return { value: "from-server" };
      },
    });
    expect(serverFetches).toBe(1);

    const dehydratedState = dehydrate(server);

    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60 * 1000, retry: false },
      },
    });

    let clientFetches = 0;

    function Consumer() {
      const { data } = useQuery({
        queryKey,
        queryFn: async () => {
          clientFetches++;
          return { value: "from-client" };
        },
        staleTime: 30 * 1000,
      });
      return <div data-testid="value">{data?.value ?? "none"}</div>;
    }

    const { getByTestId } = render(
      <QueryClientProvider client={client}>
        <HydrationBoundary state={dehydratedState}>
          <Consumer />
        </HydrationBoundary>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("value").textContent).toBe("from-server");
    });

    const state = client.getQueryState(queryKey);
    expect(state?.data).toEqual({ value: "from-server" });
    expect(clientFetches).toBe(0);
  });
});
