export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/utils/session";
import { NeedsFeed } from "@/features/neighborhood-needs/components/needs-feed";

export const metadata = {
  title: "What Your Neighbors Need",
  description: "Browse and respond to requests from your neighborhood",
};

export default async function NeighborhoodNeedsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="container pb-6">
      <PageHeader
        title="What Your Neighbors Need"
        description="Browse requests from your community and offer to help"
      >
        <Button asChild>
          <Link href="/dashboard/needs/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Post a need
          </Link>
        </Button>
      </PageHeader>
      <NeedsFeed />
    </div>
  );
}
