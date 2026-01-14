"use client";

import { useRef, useEffect, type ReactNode, type RefObject } from "react";
import { usePageHeaderContext } from "@/contexts/page-header-context";
import { cn } from "@/lib/utils";

interface PageHeaderClientProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * PageHeaderClient - Client component that sets PageHeader state in context.
 * This component handles setting the ref and title while maintaining the same
 * visual appearance and functionality as the original PageHeader.
 */
export function PageHeader({
  title,
  description,
  children,
  className = "",
}: PageHeaderClientProps) {
  const ref = useRef<HTMLDivElement>(null);
  const context = usePageHeaderContext();
  const setPageHeader = context?.setPageHeader;

  // Set PageHeader ref and title on mount, unset on unmount
  useEffect(() => {
    if (!setPageHeader) return;

    // Cast ref to HTMLElement type for context compatibility
    // HTMLDivElement extends HTMLElement, so this is safe
    const htmlElementRef = ref as RefObject<HTMLElement>;
    setPageHeader(htmlElementRef, title);

    // Cleanup: unset on unmount
    return () => {
      setPageHeader(null, null);
    };
  }, [setPageHeader, title, ref]);

  return (
    <div
      ref={ref}
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
