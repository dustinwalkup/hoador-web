import { QueryClient } from "@tanstack/react-query";
import { vi } from "vitest";

/**
 * Waits for a query to be in a specific state
 */
export async function waitForQueryState(
  queryClient: QueryClient,
  queryKey: unknown[],
  state: "loading" | "success" | "error",
) {
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const queryState = queryClient.getQueryState(queryKey);
    if (queryState?.status === state) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  throw new Error(`Query did not reach ${state} state within timeout`);
}

/**
 * Mocks React Query hooks
 */
export function mockUseQuery<T>(data: T, isLoading = false, error: Error | null = null) {
  return {
    data: isLoading ? undefined : data,
    isLoading,
    isError: !!error,
    error,
    refetch: vi.fn(),
  };
}

/**
 * Mocks React Query useMutation hook
 */
export function mockUseMutation<TData = unknown, TVariables = unknown>() {
  const mutate = vi.fn();
  const mutateAsync = vi.fn();

  return {
    mutate,
    mutateAsync,
    data: undefined as TData | undefined,
    isLoading: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  };
}

