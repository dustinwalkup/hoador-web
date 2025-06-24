import { DollarSign, Calendar, Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { type CreateToolFormData } from "@/lib/schemas/tool.schema";

interface PricingStepProps {
  formData: CreateToolFormData;
  updateFormData: (field: keyof CreateToolFormData, value: unknown) => void;
}

export function PricingStep({ formData, updateFormData }: PricingStepProps) {
  const weeklyRateSuggestion =
    formData.dailyRate > 0 ? (formData.dailyRate * 7 * 0.8).toFixed(2) : "0.00";
  const monthlyRateSuggestion =
    formData.dailyRate > 0
      ? (formData.dailyRate * 30 * 0.7).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="condition">Condition *</Label>
        <Select
          value={formData.condition}
          onValueChange={(value) => updateFormData("condition", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="excellent">Excellent - Like new</SelectItem>
            <SelectItem value="good">Good - Minor wear</SelectItem>
            <SelectItem value="fair">
              Fair - Some wear but functional
            </SelectItem>
            <SelectItem value="poor">Poor - Heavy wear but works</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="text-primary h-5 w-5" />
          <h3 className="text-lg font-semibold">Rental Rates</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dailyRate">Daily Rate *</Label>
            <div className="relative">
              <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                id="dailyRate"
                type="number"
                placeholder="0.00"
                className="pl-9"
                value={formData.dailyRate || ""}
                onChange={(e) =>
                  updateFormData(
                    "dailyRate",
                    Number.parseFloat(e.target.value) || 0,
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeklyRate">Weekly Rate</Label>
            <div className="relative">
              <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                id="weeklyRate"
                type="number"
                placeholder={weeklyRateSuggestion}
                className="pl-9"
                value={formData.weeklyRate || ""}
                onChange={(e) =>
                  updateFormData(
                    "weeklyRate",
                    Number.parseFloat(e.target.value) || undefined,
                  )
                }
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Suggested: ${weeklyRateSuggestion} (20% discount)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyRate">Monthly Rate</Label>
            <div className="relative">
              <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                id="monthlyRate"
                type="number"
                placeholder={monthlyRateSuggestion}
                className="pl-9"
                value={formData.monthlyRate || ""}
                onChange={(e) =>
                  updateFormData(
                    "monthlyRate",
                    Number.parseFloat(e.target.value) || undefined,
                  )
                }
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Suggested: ${monthlyRateSuggestion} (30% discount)
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="securityDeposit">Security Deposit</Label>
          <div className="relative">
            <Shield className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <Input
              id="securityDeposit"
              type="number"
              placeholder="0.00"
              className="pl-9"
              value={formData.securityDeposit || ""}
              onChange={(e) =>
                updateFormData(
                  "securityDeposit",
                  Number.parseFloat(e.target.value) || 0,
                )
              }
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Refundable deposit to protect against damage or loss
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-primary h-5 w-5" />
          <h3 className="text-lg font-semibold">Rental Period</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minPeriod">Minimum Rental (days)</Label>
            <Input
              id="minPeriod"
              type="number"
              min="1"
              value={formData.minimumRentalPeriod}
              onChange={(e) =>
                updateFormData(
                  "minimumRentalPeriod",
                  Number.parseInt(e.target.value) || 1,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxPeriod">Maximum Rental (days)</Label>
            <Input
              id="maxPeriod"
              type="number"
              min="1"
              value={formData.maximumRentalPeriod}
              onChange={(e) =>
                updateFormData(
                  "maximumRentalPeriod",
                  Number.parseInt(e.target.value) || 30,
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
