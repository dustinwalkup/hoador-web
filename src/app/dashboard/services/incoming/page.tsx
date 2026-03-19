import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Incoming Service Requests",
  description: "View and manage incoming service booking requests",
};

export default function ServicesIncomingPage() {
  return (
    <div className="container pb-6">
      <PageHeader
        title="Incoming Requests"
        description="Service bookings coming soon. You'll be able to view and manage incoming service requests here."
      />
      <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
        Coming soon
      </div>
    </div>
  );
}
