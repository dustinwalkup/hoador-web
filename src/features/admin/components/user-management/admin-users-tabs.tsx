"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminPendingVerifications } from "@/features/admin/hooks/use-admin-mutations";
import { AdminUsersClient } from "./admin-users-client";
import { PendingVerificationsTab } from "./pending-verifications-tab";

/**
 * Tabbed shell for the admin users page: existing user management plus the
 * residency-verification queue. The pending tab carries a live count badge.
 */
export function AdminUsersTabs() {
  const { data } = useAdminPendingVerifications({ page: 1, limit: 25 });
  const pendingCount = data?.pagination.total ?? 0;

  return (
    <Tabs defaultValue="all-users" className="space-y-6">
      <TabsList>
        <TabsTrigger value="all-users">All Users</TabsTrigger>
        <TabsTrigger value="pending-verifications" className="gap-2">
          Pending Verifications
          {pendingCount > 0 && (
            <Badge variant="secondary">{pendingCount}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all-users" className="mt-0">
        <AdminUsersClient />
      </TabsContent>
      <TabsContent value="pending-verifications" className="mt-0">
        <PendingVerificationsTab />
      </TabsContent>
    </Tabs>
  );
}
