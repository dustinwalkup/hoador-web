"use client";

import { usePathname } from "next/navigation";

interface ConditionalPaddingProps {
  children: React.ReactNode;
}

export function ConditionalPadding({ children }: ConditionalPaddingProps) {
  const pathname = usePathname();

  // Apply p-0 for mailbox route, p-4 for all other routes
  const paddingClass = pathname === "/dashboard/mailbox" ? "p-0" : "p-4";

  return (
    <div className={`container mx-auto flex-1 ${paddingClass}`}>{children}</div>
  );
}
