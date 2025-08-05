"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MailboxTabs() {
  const pathname = usePathname();
  const isArchived = pathname.includes("/archived");
  const currentTab = isArchived ? "archived" : "inbox";

  return (
    <Tabs value={currentTab} className="p-3">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="inbox" asChild>
          <Link href="/dashboard/mailbox">Inbox</Link>
        </TabsTrigger>
        <TabsTrigger value="archived" asChild>
          <Link href="/dashboard/mailbox/archived">Archived</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
