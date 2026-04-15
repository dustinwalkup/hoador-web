import { cn } from "@/lib/utils";
import { ServicesFlowHeader } from "./_components/services-flow-header";

export default function ServicesFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn("container mx-auto pb-6")}>
      <ServicesFlowHeader />
      {children}
    </div>
  );
}
