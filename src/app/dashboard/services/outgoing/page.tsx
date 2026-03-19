import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Outgoing Service Requests",
  description: "View and manage your outgoing service booking requests",
};

export default function ServicesOutgoingPage() {
  return (
    <div className="container pb-6">
      <PageHeader
        title="Outgoing Requests"
        description="Service bookings coming soon. You'll be able to view and manage your outgoing service requests here."
      />
      <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
        Coming soon
      </div>
    </div>
  );
}
