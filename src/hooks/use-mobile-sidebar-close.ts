"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Hook that automatically closes the mobile sidebar when navigation occurs
 */
export function useMobileSidebarClose() {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  useEffect(() => {
    // Only close sidebar on mobile when pathname changes
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);
}
