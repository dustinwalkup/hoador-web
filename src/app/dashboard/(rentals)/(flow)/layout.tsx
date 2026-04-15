import { cn } from "@/lib/utils";
import { RentalsFlowHeader } from "./_components/rentals-flow-header";

export default function RentalsFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn("container mx-auto pb-6")}>
      <RentalsFlowHeader />
      {children}
    </div>
  );
}
