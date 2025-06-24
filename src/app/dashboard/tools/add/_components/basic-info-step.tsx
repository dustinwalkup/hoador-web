import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CreateToolFormData } from "@/lib/schemas/tool.schema";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface BasicInfoStepProps {
  formData: CreateToolFormData;
  updateFormData: (field: keyof CreateToolFormData, value: unknown) => void;
  categories: Category[];
}

export function BasicInfoStep({
  formData,
  updateFormData,
  categories,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Tool Name *</Label>
          <Input
            id="name"
            placeholder="e.g., DeWalt Circular Saw"
            value={formData.name}
            onChange={(e) => updateFormData("name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.categoryId}
            onValueChange={(value) => updateFormData("categoryId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2">
                    <span>{category.icon || "🔧"}</span>
                    {category.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Describe your tool, its condition, and any special features..."
          rows={4}
          value={formData.description}
          onChange={(e) => updateFormData("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            placeholder="e.g., DeWalt, Makita, Bosch"
            value={formData.brand}
            onChange={(e) => updateFormData("brand", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            placeholder="e.g., DWE575SB"
            value={formData.model}
            onChange={(e) => updateFormData("model", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
