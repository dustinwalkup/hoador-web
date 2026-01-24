import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * API response type that may include a redirect URL
 */
export interface ApiResponseWithRedirect {
  success: boolean;
  redirect?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Handle redirect from API response
 * Processes redirect URLs from API responses and navigates client-side
 *
 * @param response - API response that may contain a redirect URL
 * @param router - Next.js router instance (from useRouter hook)
 * @returns true if redirect was handled, false otherwise
 */
export function handleApiRedirect(
  response: ApiResponseWithRedirect,
  router: AppRouterInstance,
): boolean {
  if (response.success && response.redirect) {
    router.push(response.redirect);
    return true;
  }
  return false;
}

/**
 * Hook for handling API redirects in React components
 * Returns a function that can be called with API responses
 *
 * @example
 * ```tsx
 * const handleRedirect = useHandleApiRedirect();
 *
 * const mutation = useMutation({
 *   mutationFn: async (data) => {
 *     const response = await fetch('/api/auth/signup', { ... });
 *     return response.json();
 *   },
 *   onSuccess: (response) => {
 *     handleRedirect(response);
 *   },
 * });
 * ```
 */
export function useHandleApiRedirect() {
  const router = useRouter();

  return (response: ApiResponseWithRedirect) => {
    return handleApiRedirect(response, router);
  };
}
