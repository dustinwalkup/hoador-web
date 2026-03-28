"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface ServiceProviderBioFormProps {
  userId: string;
  initialBio: string;
}

const serviceProviderBioSchema = z.object({
  bio: z.string().max(500, "Bio must be 500 characters or less"),
});

type ServiceProviderBioValues = z.infer<typeof serviceProviderBioSchema>;

/**
 * PATCH /api/services/providers/[userId] — bio only.
 */
export function ServiceProviderBioForm({
  userId,
  initialBio,
}: ServiceProviderBioFormProps) {
  const router = useRouter();
  const form = useForm<ServiceProviderBioValues>({
    resolver: zodResolver(serviceProviderBioSchema),
    defaultValues: { bio: initialBio },
  });

  async function save(values: ServiceProviderBioValues) {
    try {
      const res = await fetch(`/api/services/providers/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: values.bio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not save bio");
        return;
      }
      toast.success("Bio updated.");
      router.refresh();
    } catch {
      toast.error("Could not save bio");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(save)} className="max-w-xl space-y-3">
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  maxLength={500}
                  placeholder="Tell neighbors about your services..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save bio"}
        </Button>
      </form>
    </Form>
  );
}
