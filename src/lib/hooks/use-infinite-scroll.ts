import { useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  threshold?: number;
}

export function useInfiniteScroll({
  onLoadMore,
  hasNextPage = false,
  isFetchingNextPage = false,
  threshold = 100,
}: UseInfiniteScrollOptions) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, hasNextPage, isFetchingNextPage, threshold]);

  return loadMoreRef;
}
