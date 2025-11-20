import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ConversationSummary, ConversationDetails } from "@/dal/types";

const CONVERSATIONS_PER_PAGE = 20;

export function useConversations(archived: boolean = false) {
  return useInfiniteQuery({
    queryKey: ["conversations", archived],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/messages/conversations?archived=${archived}&offset=${pageParam}&limit=${CONVERSATIONS_PER_PAGE}`,
      );
      if (!response.ok) throw new Error("Failed to fetch conversations");
      const data = await response.json();
      return data as ConversationSummary[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === CONVERSATIONS_PER_PAGE
        ? allPages.length * CONVERSATIONS_PER_PAGE
        : undefined;
    },
    initialPageParam: 0,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}

export function useConversationDetails(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-details", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const response = await fetch(
        `/api/messages/conversations/${conversationId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch conversation details");
      const data = await response.json();
      return data as ConversationDetails;
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}

export function usePrefetchConversation() {
  const queryClient = useQueryClient();

  return (conversationId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["conversation-details", conversationId],
      queryFn: async () => {
        const response = await fetch(
          `/api/messages/conversations/${conversationId}`,
        );
        if (!response.ok)
          throw new Error("Failed to fetch conversation details");
        const data = await response.json();
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
