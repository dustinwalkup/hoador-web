"use client";
import { JSX, useState } from "react";
import { Edit } from "lucide-react";

import { useEditMode } from "@/lib/contexts/edit-mode-context";
import { PROFILE_TABS } from "@/lib/constants/profile";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

import { ReviewsTab } from "./reviews-tab";
import { VerificationTab } from "./verification-tab";
import { PreferencesTab } from "./preferences-tab";
import { SecurityTab } from "./security-tab";
import { BillingTab } from "./billing-tab";

export function ProfileTabs({
  profileOverview,
}: {
  profileOverview: JSX.Element;
}) {
  const { editMode, setEditMode } = useEditMode();
  const [activeTab, setActiveTab] = useState("profile");

  console.log("editMode", editMode);

  return (
    <div className="container py-6">
      <PageHeader
        title={PROFILE_TABS.title}
        description={PROFILE_TABS.description}
      >
        {activeTab === "profile" && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setEditMode(!editMode)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {PROFILE_TABS.editButton.label(editMode)}
          </Button>
        )}
      </PageHeader>

      <Tabs
        defaultValue="profile"
        className="space-y-6"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile">
            {PROFILE_TABS.tabValues[0].label}
          </TabsTrigger>
          <TabsTrigger value="reviews">
            {PROFILE_TABS.tabValues[1].label}
          </TabsTrigger>
          <TabsTrigger value="verification">
            {PROFILE_TABS.tabValues[2].label}
          </TabsTrigger>
          <TabsTrigger value="preferences">
            {PROFILE_TABS.tabValues[3].label}
          </TabsTrigger>
          <TabsTrigger value="security">
            {PROFILE_TABS.tabValues[4].label}
          </TabsTrigger>
          <TabsTrigger value="billing">
            {PROFILE_TABS.tabValues[5].label}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">{profileOverview}</TabsContent>

        <TabsContent value="reviews">
          <ReviewsTab />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationTab />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
