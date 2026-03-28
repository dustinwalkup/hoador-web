"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

function getHeaderConfig(pathname: string): {
  title: string;
  description: string;
} {
  const parts = pathname.split("/").filter(Boolean);
  const servicesIndex = parts.indexOf("services");
  const direction = servicesIndex !== -1 ? parts[servicesIndex + 1] : undefined;

  if (direction === "incoming") {
    return {
      title: "Services - Provider",
      description: "Manage your incoming service requests",
    };
  }
  return {
    title: "Services - Client",
    description: "Manage your service booking requests",
  };
}

export default function ServicesFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { title, description } = getHeaderConfig(pathname);

  return (
    <div className={cn("container mx-auto pb-6")}>
      <PageHeader title={title} description={description} className="mb-6" />
      {children}
    </div>
  );
}
