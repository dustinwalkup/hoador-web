import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HistoryTab() {
  return (
    <>
      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b p-4 font-medium">
          <div>Tool</div>
          <div>Status</div>
          <div>Date</div>
          <div>Amount</div>
        </div>
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b p-4 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="bg-muted h-10 w-10 rounded"></div>
              <div>
                <div className="font-medium">Tool Name</div>
                <div className="text-muted-foreground text-sm">
                  Owner/Borrower Name
                </div>
              </div>
            </div>
            <div>
              <Badge variant="outline">Completed</Badge>
            </div>
            <div className="text-muted-foreground text-sm">Apr 15, 2023</div>
            <div className="font-medium">$12.00</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <Button variant="outline" size="sm">
          View Complete History
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
