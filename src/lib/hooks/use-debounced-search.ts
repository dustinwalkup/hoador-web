import { useCallback, useMemo, useState } from "react";
import { debounce } from "@walkup/walkup-utils";

export function useDebouncedSearch(
  onSearch: (query: string) => void,
  delay: number = 300,
  initialQuery: string = "",
) {
  const [localQuery, setLocalQuery] = useState(initialQuery);
  const debouncedSearch = useMemo(
    () => debounce((...args: unknown[]) => onSearch(args[0] as string), delay),
    [onSearch, delay],
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      // Update local state immediately for instant feedback
      setLocalQuery(query);
      // Debounce URL update to avoid API spam
      debouncedSearch(query);
    },
    [debouncedSearch],
  );

  return { localQuery, handleSearchChange, debouncedSearch };
}
