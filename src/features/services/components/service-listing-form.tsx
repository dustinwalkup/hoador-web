"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceListing } from "@/db/schemas/services.schema";

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

const serviceListingFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  categoryId: z.string().uuid().optional(),
  pricingType: z.enum(["fixed", "hourly"]),
  price: z.number().nonnegative("Price must be 0 or higher"),
  description: z.string().min(1, "Description is required").max(20000),
  serviceNotes: z.string().max(5000).optional(),
  ownerPoliciesAcknowledged: z.boolean().refine((value) => value === true, {
    message: "You must agree to the owner policies before submitting.",
  }),
});

type ServiceListingFormValues = z.infer<typeof serviceListingFormSchema>;

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
  const form = useForm<ServiceListingFormValues>({
    resolver: zodResolver(serviceListingFormSchema),
    defaultValues: {
      title: initial?.title ?? "",
      categoryId: initial?.categoryId ?? undefined,
      pricingType: initial?.pricingType ?? "fixed",
      price: initial?.price != null ? Number(initial.price) : 0,
      description: initial?.description ?? "",
      serviceNotes: initial?.serviceNotes ?? "",
      ownerPoliciesAcknowledged: initial?.ownerPoliciesAcknowledged ?? false,
    },
    mode: "onTouched",
  });

  async function onSubmit(values: ServiceListingFormValues) {
    if (mode === "create" && !values.categoryId) {
      form.setError("categoryId", { message: "Category is required." });
      return;
    }

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
        router.push("/dashboard/services");
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
      toast.success("Listing updated.");
      router.push(`/dashboard/services/listings/${listingId}`);
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
            <CardTitle>Basic Information</CardTitle>
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
                    <Input maxLength={200} {...field} />
                  </FormControl>
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
                      onValueChange={field.onChange}
                      required
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
                    <Textarea rows={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>
              Set how you charge for this service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="pricingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={field.value || 0}
                      onChange={(event) => {
                        field.onChange(
                          Number.parseFloat(event.target.value) || 0,
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Policies</CardTitle>
            <CardDescription>
              Review and accept these policies to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-primary list-inside list-disc space-y-1 text-sm">
              <li>
                <Link href="/documents/terms-of-service.pdf" target="_blank">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/documents/privacy-policy.pdf" target="_blank">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/documents/payments-and-payouts-policy.pdf"
                  target="_blank"
                >
                  Payments &amp; Payouts Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/documents/safety-and-liability-package.pdf"
                  target="_blank"
                >
                  Safety and Liability Package
                </Link>
              </li>
              <li>
                <Link
                  href="/documents/prohibited-items-and-listing-content-policy.pdf"
                  target="_blank"
                >
                  Prohibited Items and Listing Content Policy
                </Link>
              </li>
            </ul>

            <FormField
              control={form.control}
              name="ownerPoliciesAcknowledged"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      id="ownerPoliciesAcknowledged"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel
                      htmlFor="ownerPoliciesAcknowledged"
                      className="cursor-pointer"
                    >
                      I have read and agree to the owner policies listed above.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Submit for review"
              : "Save"}
        </Button>
      </form>
    </Form>
  );
}
