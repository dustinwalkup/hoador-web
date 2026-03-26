export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";

interface ServicesDirectionPageProps {
  params: Promise<{ direction: string }>;
}

export default async function ServicesDirectionPage({
  params,
}: ServicesDirectionPageProps) {
  const { direction } = await params;

  if (direction === "incoming") {
    redirect("/dashboard/services/incoming/pending");
  } else if (direction === "outgoing") {
    redirect("/dashboard/services/outgoing/pending");
  } else {
    notFound();
  }
}
