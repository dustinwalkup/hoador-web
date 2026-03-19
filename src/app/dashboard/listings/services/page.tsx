import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "My Services",
  description: "Manage your service listings",
};

export default function ListingsServicesPage() {
  return (
    <div className="container pb-6">
      <PageHeader
        title="My Services"
        description="Service listings coming soon. You'll be able to create and manage your service offerings here."
      />
      <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
        Coming soon
      </div>
    </div>
  );
}
