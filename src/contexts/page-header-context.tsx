"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Context value interface for PageHeaderContext.
 * Stores the current PageHeader ref and title directly.
 */
export interface PageHeaderContextValue {
  /**
   * Ref to the current PageHeader DOM element.
   */
  ref: RefObject<HTMLElement> | null;

  /**
   * Title text from the current PageHeader component.
   */
  title: string | null;

  /**
   * Set the current PageHeader ref and title.
   * @param ref - React ref to the PageHeader DOM element
   * @param title - Title text from the PageHeader component
   */
  setPageHeader: (
    ref: RefObject<HTMLElement> | null,
    title: string | null,
  ) => void;
}

/**
 * Context for managing PageHeader component state.
 * Used to coordinate between PageHeader components and SiteHeaderLabel.
 */
const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

/**
 * Provider component that wraps the dashboard layout to provide
 * PageHeaderContext to all child components.
 *
 * Since there's only one PageHeader per page, we store ref and title directly.
 */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [ref, setRef] = useState<RefObject<HTMLElement> | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const setPageHeader = useCallback(
    (newRef: RefObject<HTMLElement> | null, newTitle: string | null) => {
      setRef(newRef);
      setTitle(newTitle);
    },
    [],
  );

  const contextValue = useMemo<PageHeaderContextValue>(
    () => ({
      ref,
      title,
      setPageHeader,
    }),
    [ref, title, setPageHeader],
  );

  return (
    <PageHeaderContext.Provider value={contextValue}>
      {children}
    </PageHeaderContext.Provider>
  );
}

/**
 * Hook to access PageHeaderContext.
 * Returns null if context is not available (e.g., used outside PageHeaderProvider).
 *
 * @returns PageHeaderContextValue or null if context is missing
 */
export function usePageHeaderContext(): PageHeaderContextValue | null {
  return useContext(PageHeaderContext);
}
