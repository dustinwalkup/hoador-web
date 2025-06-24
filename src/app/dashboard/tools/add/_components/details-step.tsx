import { Plus, X, Truck, DollarSign, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { type CreateToolFormData } from "@/lib/schemas/tool.schema";

interface DetailsStepProps {
  formData: CreateToolFormData;
  updateFormData: (field: keyof CreateToolFormData, value: unknown) => void;
  newSpecKey: string;
  newSpecValue: string;
  setNewSpecKey: (value: string) => void;
  setNewSpecValue: (value: string) => void;
  addSpecification: () => void;
  removeSpecification: (key: string) => void;
}

export function DetailsStep({
  formData,
  updateFormData,
  newSpecKey,
  newSpecValue,
  setNewSpecKey,
  setNewSpecValue,
  addSpecification,
  removeSpecification,
}: DetailsStepProps) {
  return (
    <div className="space-y-6">
      {/* Specifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Specifications</h3>

        <div className="flex gap-2">
          <Input
            placeholder="Specification name"
            value={newSpecKey}
            onChange={(e) => setNewSpecKey(e.target.value)}
          />
          <Input
            placeholder="Value"
            value={newSpecValue}
            onChange={(e) => setNewSpecValue(e.target.value)}
          />
          <Button
            onClick={addSpecification}
            disabled={!newSpecKey || !newSpecValue}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {Object.entries(formData.specifications).length > 0 && (
          <div className="space-y-2">
            {Object.entries(formData.specifications).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <span className="font-medium">{key}:</span> {value}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSpecification(key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Instructions & Safety */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="instructions">Usage Instructions</Label>
          <Textarea
            id="instructions"
            placeholder="How to use this tool safely and effectively..."
            rows={3}
            value={formData.instructions}
            onChange={(e) => updateFormData("instructions", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="safetyNotes">Safety Notes</Label>
          <Textarea
            id="safetyNotes"
            placeholder="Important safety information and warnings..."
            rows={3}
            value={formData.safetyNotes}
            onChange={(e) => updateFormData("safetyNotes", e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Delivery Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="text-primary h-5 w-5" />
          <h3 className="text-lg font-semibold">Pickup & Delivery</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requiresPickup">Requires Pickup</Label>
              <p className="text-muted-foreground text-sm">
                Renter must pick up the tool from your location
              </p>
            </div>
            <Switch
              id="requiresPickup"
              checked={formData.requiresPickup}
              onCheckedChange={(checked) =>
                updateFormData("requiresPickup", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="deliveryAvailable">Delivery Available</Label>
              <p className="text-muted-foreground text-sm">
                You can deliver the tool to the renter
              </p>
            </div>
            <Switch
              id="deliveryAvailable"
              checked={formData.deliveryAvailable}
              onCheckedChange={(checked) =>
                updateFormData("deliveryAvailable", checked)
              }
            />
          </div>

          {formData.deliveryAvailable && (
            <div className="border-muted ml-4 space-y-4 border-l-2 pl-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deliveryFee">Delivery Fee</Label>
                  <div className="relative">
                    <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                    <Input
                      id="deliveryFee"
                      type="number"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.deliveryFee || ""}
                      onChange={(e) =>
                        updateFormData(
                          "deliveryFee",
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryRadius">
                    Delivery Radius (miles)
                  </Label>
                  <div className="relative">
                    <MapPin className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                    <Input
                      id="deliveryRadius"
                      type="number"
                      placeholder="10"
                      className="pl-9"
                      value={formData.deliveryRadius || ""}
                      onChange={(e) =>
                        updateFormData(
                          "deliveryRadius",
                          Number.parseInt(e.target.value) || 0,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
