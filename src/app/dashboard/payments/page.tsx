export const dynamic = "force-dynamic";
import { PAYMENTS_PAGE_HEADERS } from "@/constants/payments";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { paymentDAL } from "@/dal";
import { PaymentsTabs } from "@/features/payments/components";
import { PaymentsPageClient } from "@/features/payments/components";

export const metadata = {
  title: "Payments",
  description: "Manage your payment methods and view payment history",
};

interface PaymentsPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

/**
 * Payments page server component
 * Fetches user data and payment history server-side
 */
export default async function PaymentsPage({
  searchParams,
}: PaymentsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container pb-6">
        <PageHeader
          title={PAYMENTS_PAGE_HEADERS.payments.title}
          description={PAYMENTS_PAGE_HEADERS.payments.description}
        />
        <PaymentsTabs>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              Please sign in to view payments.
            </p>
          </div>
        </PaymentsTabs>
      </div>
    );
  }

  // Await searchParams to get the actual values
  const params = await searchParams;

  // Parse page number from URL (default to 1)
  const page = parseInt(params?.page || "1", 10);
  const limit = 10;

  // Fetch paginated payment history
  const paymentHistoryResult = await paymentDAL.getUserRentalPayments(user.id, {
    page,
    limit,
  });

  return (
    <div className="container pb-6">
      <PageHeader
        title={PAYMENTS_PAGE_HEADERS.payments.title}
        description={PAYMENTS_PAGE_HEADERS.payments.description}
      />

      <PaymentsTabs>
        <PaymentsPageClient
          paymentHistory={paymentHistoryResult.data}
          pagination={paymentHistoryResult.pagination}
          currentPage={page}
        />
      </PaymentsTabs>
    </div>
  );
}
