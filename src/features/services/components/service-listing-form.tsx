"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type input, type output, z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { OwnerPoliciesAcknowledgment } from "@/components/legal/owner-policies-acknowledgment";
import { Input } from "@/components/ui/input";
import {
  NumericInput,
  toNumericInputValue,
} from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceListing } from "@/db/schemas/services.schema";
import { AlertTriangle, DollarSign, Package } from "lucide-react";

interface CategoryOption {
  id: string;
  name: string;
}

interface ServiceListingFormProps {
  mode: "create" | "edit";
  listingId?: string;
  communityId: string;
  categories: CategoryOption[];
  initial?: Partial<ServiceListing>;
}

const baseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  categoryId: z.string().optional(),
  pricingType: z.enum(["fixed", "hourly"]),
  price: z
    .union([z.literal(""), z.number()])
    .superRefine((val, ctx) => {
      if (val === "") {
        ctx.addIssue({
          code: "custom",
          message: "Price is required",
        });
        return;
      }
      if (val < 0) {
        ctx.addIssue({
          code: "custom",
          message: "Price must be 0 or higher",
        });
      }
    })
    .transform((val): number => {
      if (val === "") {
        throw new Error("invalid price");
      }
      return val;
    }),
  description: z.string().min(1, "Description is required").max(20000),
  serviceNotes: z.string().max(5000).optional(),
  ownerPoliciesAcknowledged: z.boolean().refine((value) => value === true, {
    message: "You must agree to the owner policies before submitting.",
  }),
});

// Create mode requires categoryId; superRefine keeps the inferred type identical to baseSchema
const createSchema = baseSchema.superRefine((data, ctx) => {
  if (!data.categoryId) {
    ctx.addIssue({
      code: "custom",
      message: "Category is required.",
      path: ["categoryId"],
    });
  }
});

type ServiceListingFormInput = input<typeof baseSchema>;
type ServiceListingFormValues = output<typeof baseSchema>;

/**
 * Create or edit a service listing (POST /api/services/listings or PATCH .../[id]).
 */
export function ServiceListingForm({
  mode,
  listingId,
  communityId,
  categories,
  initial,
}: ServiceListingFormProps) {
  const router = useRouter();
  const isResubmittingDenied = mode === "edit" && initial?.status === "denied";
  const form = useForm<
    ServiceListingFormInput,
    unknown,
    ServiceListingFormValues
  >({
    resolver: zodResolver(mode === "create" ? createSchema : baseSchema),
    defaultValues: {
      title: initial?.title ?? "",
      ...(mode === "create" ? { categoryId: "" } : {}),
      pricingType: initial?.pricingType ?? "fixed",
      price: initial?.price != null ? Number(initial.price) : 0,
      description: initial?.description ?? "",
      serviceNotes: initial?.serviceNotes ?? "",
      ownerPoliciesAcknowledged: initial?.ownerPoliciesAcknowledged ?? false,
    },
    mode: "onTouched",
  });

  async function onSubmit(values: ServiceListingFormValues): Promise<void> {
    try {
      if (mode === "create") {
        const res = await fetch("/api/services/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communityId,
            categoryId: values.categoryId,
            title: values.title.trim(),
            description: values.description.trim(),
            pricingType: values.pricingType,
            price: values.price,
            ownerPoliciesAcknowledged: values.ownerPoliciesAcknowledged,
            serviceNotes: values.serviceNotes?.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Could not create listing");
          return;
        }
        toast.success(
          "Your listing has been submitted for review. You'll be notified when it's approved.",
        );
        router.push("/dashboard/listings/services");
        router.refresh();
        return;
      }

      if (!listingId) return;
      const res = await fetch(`/api/services/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title.trim(),
          description: values.description.trim(),
          pricingType: values.pricingType,
          price: values.price,
          ownerPoliciesAcknowledged: values.ownerPoliciesAcknowledged,
          serviceNotes: values.serviceNotes?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not save listing");
        return;
      }
      toast.success(
        isResubmittingDenied
          ? "Your changes have been submitted for review. You'll be notified when it's approved."
          : "Listing updated.",
      );
      router.push("/dashboard/listings/services");
      router.refresh();
    } finally {
      form.reset(values, { keepValues: true });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-2xl space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="text-primary h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Tell neighbors about your service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing title *</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={200}
                      placeholder="e.g., Lawn mowing, furniture assembly, dog walking"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A clear title helps neighbors find your service.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "create" ? (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        field.onBlur();
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the category that best describes what you offer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Describe what you offer, your experience, any requirements or limitations..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe what you offer, any requirements, and your
                    availability.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="text-primary h-5 w-5" /> Pricing
            </CardTitle>
            <CardDescription>
              Set how you charge for this service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pricingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pricing type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Flat rate</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Flat rate = one price for the whole job. Hourly = billed
                      by the hour.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (USD) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <NumericInput
                          variant="decimal"
                          maxFractionDigits={2}
                          placeholder="0.00"
                          className="pl-9"
                          name={field.name}
                          ref={field.ref}
                          value={toNumericInputValue(field.value)}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Enter 0 if your pricing varies — add details in Service
                      Notes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="serviceNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="e.g., I travel within 5 miles, 24-hour advance booking required"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: mention travel limits, materials needed, booking
                    requirements, etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <OwnerPoliciesAcknowledgment
          control={form.control}
          fieldName="ownerPoliciesAcknowledged"
          showAdminReviewCallout={mode === "create"}
          introText="Please review the following policies before submitting your service listing."
          adminReviewMessage="Your service listing will be reviewed by an admin before being published. You'll receive a notification once it's approved."
          className="space-y-6 rounded-lg border p-6"
        />

        {form.formState.submitCount > 0 &&
          Object.keys(form.formState.errors).length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please review the errors above before submitting.
              </AlertDescription>
            </Alert>
          )}

        <div className="flex w-full justify-end">
          <Button
            type="submit"
            disabled={
              form.formState.isSubmitting ||
              (mode === "edit" && !form.formState.isDirty)
            }
          >
            {form.formState.isSubmitting
              ? "Saving..."
              : mode === "create"
                ? "Submit for review"
                : isResubmittingDenied
                  ? "Save and resubmit for review"
                  : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
