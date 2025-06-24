import { toolDAL } from "@/lib/dal";
import { AddToolForm } from "./_components/add-tool-form";

export default async function AddToolPage() {
  const categories = await toolDAL.getToolCategories();
  return <AddToolForm categories={categories} />;
}
