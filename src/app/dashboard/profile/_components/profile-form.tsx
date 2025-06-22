"use client";

import { JSX, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { updateUserProfileAndAddress } from "@/lib/actions/update-user-profile";
import { useEditMode } from "@/lib/contexts/edit-mode-context";
import { PROFILE_OVERVIEW } from "@/lib/constants/profile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserProfile } from "@/lib/dal/types";
import { Textarea } from "@/components/ui/textarea";

const ProfileFormSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(4).max(10),
  }),
});

export type FormData = z.infer<typeof ProfileFormSchema>;

export function ProfileForm({ user }: { user: UserProfile }) {
  const { editMode, setEditMode } = useEditMode();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormData>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || "",
      bio: user.bio || "",
      address: {
        street: user.primaryAddress?.street || "",
        city: user.primaryAddress?.city || "",
        state: user.primaryAddress?.state || "",
        zipCode: user.primaryAddress?.zipCode || "",
      },
    },
  });

  const handleSubmit = (data: FormData) => {
    startTransition(async () => {
      const res = await updateUserProfileAndAddress(data);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Profile updated");
        setEditMode(false);
      }
    });
  };

  const renderField = (id: string, content: JSX.Element, value: string) =>
    editMode ? (
      content
    ) : (
      <div className="rounded-md border px-3 py-2">{value}</div>
    );

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            {PROFILE_OVERVIEW.formCard.fields.firstName}
          </Label>
          {renderField(
            "firstName",
            <Input {...form.register("firstName")} />,
            user.firstName,
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">
            {PROFILE_OVERVIEW.formCard.fields.lastName}
          </Label>
          {renderField(
            "lastName",
            <Input {...form.register("lastName")} />,
            user.lastName,
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{PROFILE_OVERVIEW.formCard.fields.email}</Label>
        {renderField(
          "email",
          <Input type="email" {...form.register("email")} />,
          user.email,
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{PROFILE_OVERVIEW.formCard.fields.phone}</Label>
        {renderField(
          "phone",
          <Input type="tel" {...form.register("phone")} />,
          user.phone || "",
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">
          {PROFILE_OVERVIEW.formCard.fields.street}
        </Label>
        {renderField(
          "address.street",
          <Input {...form.register("address.street")} />,
          user.primaryAddress?.street || "",
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">{PROFILE_OVERVIEW.formCard.fields.city}</Label>
          {renderField(
            "address.city",
            <Input {...form.register("address.city")} />,
            user.primaryAddress?.city || "",
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">
            {PROFILE_OVERVIEW.formCard.fields.state}
          </Label>
          {renderField(
            "address.state",
            <Input {...form.register("address.state")} />,
            user.primaryAddress?.state || "",
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="zipCode">
            {PROFILE_OVERVIEW.formCard.fields.zipCode}
          </Label>
          {renderField(
            "address.zipCode",
            <Input {...form.register("address.zipCode")} />,
            user.primaryAddress?.zipCode || "",
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">{PROFILE_OVERVIEW.formCard.fields.bio}</Label>
        {editMode ? (
          <Textarea rows={4} {...form.register("bio")} />
        ) : (
          <div className="rounded-md border px-3 py-2 whitespace-pre-line">
            {user.bio || ""}
          </div>
        )}
      </div>

      {editMode && (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      )}
    </form>
  );
}
