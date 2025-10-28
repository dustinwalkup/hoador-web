import { useState } from "react";
import { Plus, Settings, X } from "lucide-react";
import { Control, UseFormGetValues } from "react-hook-form";

import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface AdditionalDetailsSectionProps {
  control: Control<CreateListingFormDataClientType>;
  getValues: UseFormGetValues<CreateListingFormDataClientType>;
  addSpecification: (
    key: string,
    value: string | number | boolean | string[],
  ) => void;
  removeSpecification: (key: string) => void;
}

export function AdditionalDetailsSection({
  control,
  getValues,
  addSpecification,
  removeSpecification,
}: AdditionalDetailsSectionProps) {
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="text-primary h-5 w-5" />
          Additional Details
        </CardTitle>
        <CardDescription>
          Optional specifications and instructions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Specifications */}
        <h4 className="font-medium">Specifications</h4>
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="Specification name (e.g., Power)"
              value={newSpecKey}
              onChange={(e) => setNewSpecKey(e.target.value)}
              className="text-base"
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Value (e.g., 1200W)"
              value={newSpecValue}
              onChange={(e) => setNewSpecValue(e.target.value)}
              className="flex-1 text-base"
            />
            <Button
              type="button"
              onClick={() => {
                addSpecification(newSpecKey, newSpecValue);
                setNewSpecKey("");
                setNewSpecValue("");
              }}
              disabled={!newSpecKey || !newSpecValue}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {Object.entries(getValues("specifications")).length > 0 && (
          <div className="space-y-2">
            {Object.entries(getValues("specifications")).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="text-sm">
                  <span className="font-medium">{key}:</span> {String(value)}
                </div>
                <Button
                  type="button"
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
        <Separator />
        <FormField
          control={control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Usage Instructions</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="How to use this tool safely and effectively..."
                  rows={3}
                  {...field}
                  className="resize-none text-base"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="safetyNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Safety Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Important safety information and warnings..."
                  rows={3}
                  {...field}
                  className="resize-none text-base"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
