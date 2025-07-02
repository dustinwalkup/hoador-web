import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { toolDAL } from "@/lib/dal";
import { ToolDetailView } from "./_components/tool-detail-view";

interface ToolDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const currentUser = await getCurrentUser();
  const tool = await toolDAL.getToolById(params.id, currentUser.id);

  if (!tool) {
    notFound();
  }

  const isOwner = currentUser.id === tool.owner.id;

  return <ToolDetailView tool={tool} isOwner={isOwner} />;
}
