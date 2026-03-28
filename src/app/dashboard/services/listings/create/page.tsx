export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { communityDAL, serviceListingDAL, userDAL } from "@/dal";
import { ServiceListingForm } from "@/features/services/components/service-listing-form";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Create service listing",
};

export default async function CreateServiceListingPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const membership = await communityDAL.getMembershipForUser(userId);
  if (!membership) {
    return (
      <div className="container pb-6">
        <PageHeader
          title="Create listing"
          description="Join a community first."
        />
      </div>
    );
  }

  const [user, categories] = await Promise.all([
    userDAL.getUserById(userId),
    serviceListingDAL.listCategories(),
  ]);

  const connectOk = Boolean(
    user.stripeConnectedAccountId &&
    user.connectChargesEnabled &&
    user.connectPayoutsEnabled,
  );

  if (!connectOk) {
    return (
      <div className="container max-w-2xl pb-10">
        <PageHeader
          title="Stripe Connect required"
          description="Complete payouts onboarding before offering services."
        />
        <p className="text-muted-foreground mb-4 text-sm">
          We use Stripe Connect to pay providers safely. Finish onboarding, then
          return here to create your listing.
        </p>
        <Button asChild>
          <Link href="/dashboard/payments/earnings-and-payouts">
            Set up payouts
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl pb-10">
      <PageHeader
        title="Create service listing"
        description="Submit for admin approval. You can edit details later."
      />
      <ServiceListingForm
        mode="create"
        communityId={membership.community.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
