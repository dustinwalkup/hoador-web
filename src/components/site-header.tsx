import { SidebarTrigger } from "@/components/ui/sidebar";
import { SiteHeaderLabel } from "./site-header-label";

export function SiteHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <SiteHeaderLabel />
      </div>
    </header>
  );
}
