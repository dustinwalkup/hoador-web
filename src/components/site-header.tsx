import { SidebarTrigger } from "@/components/ui/sidebar";
import { SiteHeaderLabel } from "./site-header-label";

export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 border-b backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="coarse:-ml-2 -ml-1" />
        <SiteHeaderLabel />
      </div>
    </header>
  );
}
