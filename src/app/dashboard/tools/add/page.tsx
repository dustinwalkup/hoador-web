import { toolDAL } from "@/dal";
import { AddToolForm } from "./_components/add-tool-form";
import { BackButton } from "../../../../components/back-button";

export default async function AddToolPage() {
  const categories = await toolDAL.getToolCategories();

  return (
    <>
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Add New Tool</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            List your tool to start earning money from your garage
          </p>
        </div>
      </div>
      <AddToolForm categories={categories} />
    </>
  );
}
