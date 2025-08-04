import { notFound } from "next/navigation";
import { toolDAL } from "@/lib/dal";
import { getCurrentUser } from "@/lib/auth/auth.utils";
import { RentToolPageContent } from "./_components/rent-tool-page-content";

interface RentToolPageProps {
  params: Promise<{ id: string }>;
}

export default async function RentToolPage({ params }: RentToolPageProps) {
  // Get the current user - they must be authenticated to rent
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    // Redirect to login would be handled by middleware
    notFound();
  }

  const { id } = await params;

  // Get tool details
  const tool = await toolDAL.getToolById(id, currentUser.id);

  if (!tool) {
    notFound();
  }

  // Prevent users from renting their own tools
  if (tool.owner.id === currentUser.id) {
    notFound();
  }

  return <RentToolPageContent tool={tool} />;
}
