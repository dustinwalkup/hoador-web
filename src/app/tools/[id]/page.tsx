import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth.utils";
import { toolDAL } from "@/lib/dal";
import { ToolDetailView } from "../../dashboard/tools/[id]/_components/tool-detail-view";

interface PublicToolDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicToolDetailPage({
  params,
}: PublicToolDetailPageProps) {
  // For public view, we may or may not have a current user
  const currentUser = await getCurrentUser().catch(() => null);
  const { id } = await params;

  // Get tool details - pass undefined for userId if no user is logged in
  const tool = await toolDAL.getToolById(id, currentUser?.id || undefined);

  if (!tool) {
    notFound();
  }

  // Public view always shows as non-owner (isOwner = false)
  return <ToolDetailView tool={tool} isOwner={false} />;
}
