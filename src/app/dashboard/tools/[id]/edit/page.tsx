import { notFound } from "next/navigation";

import { toolDAL } from "@/lib/dal";
import { updateTool } from "@/lib/actions/update-tool";
import { getCurrentUser } from "@/lib/auth/auth.utils";
import type { ToolDetails } from "@/lib/dal/types";
import type { CreateToolFormDataClientType } from "@/lib/form-schemas/tool.schema";

import { BackButton } from "@/components/back-button";
import { AddToolForm } from "../../add/_components/add-tool-form";

function mapToolToFormData(tool: ToolDetails): CreateToolFormDataClientType {
  return {
    name: tool.name,
    description: tool.description,
    categoryId: tool.category.id,
    brand: tool.brand,
    model: tool.model,
    condition: tool.condition as "excellent" | "good" | "fair" | "poor",
    dailyRate: tool.dailyRate,
    weeklyRate: tool.weeklyRate,
    monthlyRate: tool.monthlyRate,
    securityDeposit: tool.securityDeposit,
    images: [], // Images will be loaded by the useToolImages hook
    specifications: tool.specifications,
    instructions: tool.instructions,
    safetyNotes: tool.safetyNotes,
    minimumRentalPeriod: tool.minimumRentalPeriod,
    maximumRentalPeriod: tool.maximumRentalPeriod,
    requiresPickup: tool.requiresPickup,
    deliveryAvailable: tool.deliveryAvailable,
    deliveryFee: tool.deliveryFee,
    deliveryRadius: tool.deliveryRadius,
  };
}

export default async function EditToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  const { id } = await params;
  const tool = await toolDAL.getToolById(id, currentUser.id);
  if (!tool) return notFound();
  const categories = await toolDAL.getToolCategories();

  const initialValues = mapToolToFormData(tool);

  async function onSubmit(data: Omit<CreateToolFormDataClientType, "images">) {
    "use server";
    // Call updateTool action
    return updateTool(id, data);
  }

  return (
    <>
      <div className="mb-6">
        <BackButton />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Edit Tool</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            List your tool to start earning money from your garage
          </p>
        </div>
      </div>
      <AddToolForm
        categories={categories}
        initialValues={initialValues}
        onSubmit={onSubmit}
        isEdit
        toolId={id}
      />
    </>
  );
}
