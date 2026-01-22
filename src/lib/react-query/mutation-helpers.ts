import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { QueryKey } from "@tanstack/react-query";

/**
 * Standard mutation error handler
 * Shows toast notification with error message
 * If customMessage is provided, it takes precedence over the error's message
 */
export function handleMutationError(
  error: unknown,
  customMessage?: string,
): void {
  const errorMessage = customMessage
    ? customMessage
    : error instanceof Error
      ? error.message
      : "An error occurred";

  toast.error(errorMessage, {
    duration: 5000,
  });
}

/**
 * Standard mutation success handler
 * Shows toast notification with success message
 */
export function handleMutationSuccess(message: string): void {
  toast.success(message, {
    duration: 3000,
  });
}

/**
 * Invalidate queries helper
 * Invalidates queries and optionally shows success message
 */
export function invalidateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  successMessage?: string,
): void {
  queryClient.invalidateQueries({ queryKey });

  if (successMessage) {
    handleMutationSuccess(successMessage);
  }
}

/**
 * Create a mutation hook with standard error and success handling
 * Provides consistent patterns for all mutations
 *
 * @example
 * ```ts
 * const mutation = useCreateMutation({
 *   mutationFn: async (data) => fetch('/api/resource', { method: 'POST', body: JSON.stringify(data) }),
 *   successMessage: 'Resource created successfully',
 *   invalidateQueryKeys: [['resources']],
 * });
 * ```
 */
export function useCreateMutation<
  TData = unknown,
  TVariables = unknown,
  TError = Error,
>({
  mutationFn,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
  invalidateQueryKeys,
  ...options
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  successMessage?: string;
  errorMessage?: string;
  invalidateQueryKeys?: QueryKey[];
} & Omit<
  UseMutationOptions<TData, TError, TVariables>,
  "mutationFn" | "onSuccess" | "onError"
>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onSuccess: async (data, variables, _context) => {
      // Invalidate queries if provided
      if (invalidateQueryKeys) {
        invalidateQueryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      // Show success message if provided
      if (successMessage) {
        handleMutationSuccess(successMessage);
      }

      // Call custom onSuccess if provided
      if (onSuccess) {
        await onSuccess(data, variables);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onError: async (error, variables, _context) => {
      // Show error message - use custom errorMessage if provided, otherwise use error's message
      if (errorMessage) {
        handleMutationError(error, errorMessage);
      } else {
        handleMutationError(error);
      }

      // Call custom onError if provided
      if (onError) {
        await onError(error, variables);
      }
    },
    ...options,
  });
}

/**
 * Create a mutation hook factory for common patterns
 * Returns a hook that can be used with shared configuration
 *
 * @example
 * ```ts
 * const useCreateResource = createMutationFactory({
 *   mutationFn: async (data) => fetch('/api/resources', { method: 'POST', body: JSON.stringify(data) }),
 *   invalidateQueryKeys: [['resources']],
 *   defaultSuccessMessage: 'Resource created',
 * });
 *
 * // In component:
 * const mutation = useCreateResource();
 * ```
 */
export function createMutationFactory<
  TData = unknown,
  TVariables = unknown,
>(config: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateQueryKeys?: QueryKey[];
  defaultSuccessMessage?: string;
  defaultErrorMessage?: string;
}) {
  return (options?: {
    onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables) => void | Promise<void>;
    successMessage?: string;
    errorMessage?: string;
    additionalInvalidateKeys?: QueryKey[];
  }) => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: config.mutationFn,
      onSuccess: async (data, variables) => {
        // Invalidate all specified query keys
        const allKeys = [
          ...(config.invalidateQueryKeys || []),
          ...(options?.additionalInvalidateKeys || []),
        ];

        allKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });

        // Show success message
        const successMsg =
          options?.successMessage || config.defaultSuccessMessage;
        if (successMsg) {
          handleMutationSuccess(successMsg);
        }

        // Call custom onSuccess
        if (options?.onSuccess) {
          await options.onSuccess(data, variables);
        }
      },
      onError: async (error, variables) => {
        // Show error message - prioritize custom errorMessage, then defaultErrorMessage, then error's message
        if (options?.errorMessage) {
          handleMutationError(error, options.errorMessage);
        } else if (config.defaultErrorMessage) {
          handleMutationError(error, config.defaultErrorMessage);
        } else {
          handleMutationError(error);
        }

        // Call custom onError
        if (options?.onError) {
          await options.onError(error, variables);
        }
      },
    });
  };
}
