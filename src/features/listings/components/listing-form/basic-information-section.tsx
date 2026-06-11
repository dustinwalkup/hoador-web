import { Package } from "lucide-react";
import { Control } from "react-hook-form";

import type { CreateListingFormClientValues } from "@/features/listings/form-schema/listing.schema";
import { emojiMap } from "@/constants/garage";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

import { AISuggestedBadge } from "./ai-suggested-badge";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface BasicInformationSectionProps {
  control: Control<CreateListingFormClientValues>;
  categories: Category[];
}

export function BasicInformationSection({
  control,
  categories,
}: BasicInformationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="text-primary h-5 w-5" />
          Basic Information
        </CardTitle>
        <CardDescription>Tell us about your listing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Listing Name <span className="text-destructive">*</span>
                <AISuggestedBadge fieldKey="name" />
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g., DeWalt Circular Saw" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Category <span className="text-destructive">*</span>
                <AISuggestedBadge fieldKey="categoryId" />
              </FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full text-base md:w-fit">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          {category.icon && (
                            <span>{emojiMap[category.icon]}</span>
                          )}
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Description <span className="text-destructive">*</span>
                <AISuggestedBadge fieldKey="description" />
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your listing, its condition, and any special features..."
                  rows={4}
                  {...field}
                  className="resize-none text-base"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Brand
                  <AISuggestedBadge fieldKey="brand" />
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., DeWalt, Makita, Bosch"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Model
                  <AISuggestedBadge fieldKey="model" />
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., DWE575SB"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name="condition"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Condition <span className="text-destructive">*</span>
                <AISuggestedBadge fieldKey="condition" />
              </FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full text-base md:w-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Excellent - Like new</SelectItem>
                    <SelectItem value="good">Good - Minor wear</SelectItem>
                    <SelectItem value="fair">
                      Fair - Some wear but functional
                    </SelectItem>
                    <SelectItem value="poor">
                      Poor - Heavy wear but works
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
