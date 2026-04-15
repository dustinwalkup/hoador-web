"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/page-header";

function getHeaderConfig(pathname: string): {
  title: string;
  description: string;
} {
  const parts = pathname.split("/").filter(Boolean);
  const servicesIndex = parts.indexOf("services");
  const direction = servicesIndex !== -1 ? parts[servicesIndex + 1] : undefined;

  if (direction === "incoming") {
    return {
      title: "Your service bookings",
      description: "Manage your incoming service requests",
    };
  }
  return {
    title: "Your service bookings",
    description: "Manage your service booking requests",
  };
}

export function ServicesFlowHeader() {
  const pathname = usePathname();
  const { title, description } = getHeaderConfig(pathname);
  return (
    <PageHeader title={title} description={description} className="mb-6" />
  );
}
