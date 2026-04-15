"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENTS_TABS } from "@/constants/payments";
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs";
import { PaymentsTabTrigger } from "./payments-tab-trigger";
import { useCreateLoginLink } from "../hooks/use-stripe-connect";

interface PaymentsTabsProps {
  children: ReactNode;
  isOnboarded?: boolean;
}

export function PaymentsTabs({ children, isOnboarded }: PaymentsTabsProps) {
  const pathname = usePathname();

  // Determine the active tab based on the current pathname
  const getActiveTab = () => {
    if (pathname === "/dashboard/payments") return "payments";
    const tabValue = pathname.split("/").pop();
    return tabValue || "payments";
  };

  const activeTab = getActiveTab();

  const createLoginLinkMutation = useCreateLoginLink();

  const handleOpenExpressDashboard = () => {
    createLoginLinkMutation.mutate(undefined);
  };

  // Only show advanced settings when onboarded AND on earnings-and-payouts tab
  const showAdvancedSettings =
    isOnboarded === true && activeTab === "earnings-and-payouts";

  return (
    <Tabs value={activeTab} className="space-y-6">
      <div className="coarse:mb-1 -mx-4 flex flex-col gap-3 px-4 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:px-0">
        <TabsList className="flex max-w-fit items-center justify-start gap-1 overflow-x-auto">
          {PAYMENTS_TABS.tabValues.map((tab) => (
            <PaymentsTabTrigger key={tab.value} tab={tab} />
          ))}
        </TabsList>

        {showAdvancedSettings && (
          <div className="flex shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenExpressDashboard}
              disabled={createLoginLinkMutation.isPending}
              className="text-muted-foreground"
            >
              {createLoginLinkMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Advanced settings
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <TabsContent value={activeTab} className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  );
}
