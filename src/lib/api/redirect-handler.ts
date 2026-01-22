import { useRouter } from "next/navigation";

/**
 * Hook for handling redirect URLs from API responses
 * Processes redirect URLs and navigates client-side
 */
export function useApiRedirect() {
  const router = useRouter();

  return (redirectUrl: string | undefined) => {
    if (!redirectUrl) return;
    router.push(redirectUrl);
  };
}
