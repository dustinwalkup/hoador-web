"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCreateNeed,
  useUpdateNeed,
} from "@/features/neighborhood-needs/hooks/use-needs-mutations";
import { NeedShareSuccess } from "./need-share-success";
import { NeedsIntroCallout } from "./needs-intro-callout";
import { emojiMap } from "@/constants/garage";
import { SERVICE_CATEGORY_ICONS } from "@/constants/services";
import type { NeighborhoodNeed } from "@/db/schemas/neighborhood-needs.schema";

interface Category {
  id: string;
  name: string;
  /** Rental categories carry an emoji key (mapped via `emojiMap`). */
  icon?: string | null;
}

interface CreateNeedFormProps {
  rentalCategories: Category[];
  serviceCategories: Category[];
  /** When provided, the form edits this Need instead of creating a new one. */
  need?: NeighborhoodNeed;
}

const schema = z
  .object({
    type: z.enum(["rental", "service"]),
    categoryId: z.string().min(1, "Please select a category"),
    title: z
      .string()
      .min(1, "Title is required")
      .max(120, "Title must be 120 characters or less"),
    description: z.string().min(1, "Description is required"),
    neededStartDate: z.string().optional(),
    neededEndDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.neededStartDate && data.neededEndDate) {
        return data.neededEndDate >= data.neededStartDate;
      }
      return true;
    },
    { message: "End date must be after start date", path: ["neededEndDate"] },
  );

type FormValues = z.infer<typeof schema>;

export function CreateNeedForm({
  rentalCategories,
  serviceCategories,
  need,
}: CreateNeedFormProps) {
  const isEditing = Boolean(need);
  const router = useRouter();
  const [createdNeed, setCreatedNeed] = useState<NeighborhoodNeed | null>(null);
  const createNeed = useCreateNeed();
  const updateNeed = useUpdateNeed();
  const mutation = isEditing ? updateNeed : createNeed;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: need?.type ?? "rental",
      categoryId: need?.categoryId ?? "",
      title: need?.title ?? "",
      description: need?.description ?? "",
      neededStartDate: need?.neededStartDate ?? "",
      neededEndDate: need?.neededEndDate ?? "",
    },
  });

  const selectedType = useWatch({ control: form.control, name: "type" });
  const categories =
    selectedType === "rental" ? rentalCategories : serviceCategories;

  // Emoji shown next to each category, matching the explore/browse pages:
  // rentals map a DB icon key via `emojiMap`; services look up by name.
  const categoryEmoji = (cat: Category) =>
    selectedType === "rental"
      ? (cat.icon && emojiMap[cat.icon]) || ""
      : (SERVICE_CATEGORY_ICONS[cat.name] ?? "💼");

  const watchedStartDate = useWatch({
    control: form.control,
    name: "neededStartDate",
  });

  // Native date-picker guards: block past dates, and stop the end date from
  // preceding the start date. When editing a need whose start is already in the
  // past, keep that saved value valid so it isn't rejected on save.
  const today = new Date().toISOString().split("T")[0];
  const startDateMin =
    need?.neededStartDate && need.neededStartDate < today
      ? need.neededStartDate
      : today;
  const endDateMin = watchedStartDate || startDateMin;

  const onTypeChange = (newType: "rental" | "service") => {
    form.setValue("type", newType);
    form.setValue("categoryId", ""); // reset category when type changes
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (need) {
        // Type is immutable on edit; the API derives category validation from it.
        await updateNeed.mutateAsync({
          id: need.id,
          input: {
            categoryId: values.categoryId,
            title: values.title,
            description: values.description,
            neededStartDate: values.neededStartDate || null,
            neededEndDate: values.neededEndDate || null,
          },
        });
        toast.success("Your need was updated");
        router.push(`/dashboard/needs/${need.id}`);
        router.refresh();
        return;
      }

      const result = await createNeed.mutateAsync({
        type: values.type,
        categoryId: values.categoryId,
        title: values.title,
        description: values.description,
        neededStartDate: values.neededStartDate || null,
        neededEndDate: values.neededEndDate || null,
      });
      setCreatedNeed(result);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEditing
            ? "Failed to update your need"
            : "Failed to post your need",
      );
    }
  };

  if (createdNeed) {
    return <NeedShareSuccess need={createdNeed} />;
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      {!isEditing && <NeedsIntroCallout context="post" />}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {isEditing ? "Edit Need" : "Post a Neighborhood Need"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update the details of your request."
              : "Share a few details so nearby neighbors can help."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <div className="flex gap-2">
                      {(["rental", "service"] as const).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={field.value === t ? "default" : "outline"}
                          size="sm"
                          disabled={isEditing}
                          className={
                            field.value !== t ? "bg-transparent" : undefined
                          }
                          onClick={() => onTypeChange(t)}
                        >
                          {t === "rental" ? "Rental" : "Service"}
                        </Button>
                      ))}
                    </div>
                    {isEditing && (
                      <p className="text-muted-foreground text-xs">
                        Type can&apos;t be changed after posting.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      key={selectedType}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => {
                          const emoji = categoryEmoji(cat);
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              {emoji ? `${emoji} ${cat.name}` : cat.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Need a pressure washer for my driveway"
                        maxLength={120}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what you need, when, and any details that would help a neighbor respond..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dates */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="neededStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Start date{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" min={startDateMin} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="neededEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        End date{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" min={endDateMin} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
              >
                {isEditing
                  ? mutation.isPending
                    ? "Saving…"
                    : "Save Changes"
                  : mutation.isPending
                    ? "Posting…"
                    : "Post Need"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
