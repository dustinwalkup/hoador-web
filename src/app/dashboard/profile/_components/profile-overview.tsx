"use client";

import { Star, MapPin, Calendar, Camera } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  getUserCity,
  getUserFullName,
  getUserInitials,
  getUserState,
} from "@/lib/utils/users.utils";
import { UserProfile } from "@/lib/dal/types";
import { JSX, useTransition } from "react";
import { useForm } from "react-hook-form";
import { updateUserProfileAndAddress } from "@/lib/actions/update-user-profile";

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

export function ProfileOverview({
  user,
  editMode,
  setEditMode,
}: {
  user: UserProfile;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
}) {
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
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Your public profile image</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="relative mb-4">
            <Avatar className="h-32 w-32">
              <AvatarImage
                src={"/avatar-steve.png"}
                alt={`Avatar for ${getUserFullName(user)}`}
              />
              <AvatarFallback className="text-2xl">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            {editMode && (
              <Button
                size="icon"
                className="absolute right-0 bottom-0 h-8 w-8 rounded-full shadow-lg"
                variant="secondary"
              >
                <Camera className="h-4 w-4" />
                <span className="sr-only">Change profile picture</span>
              </Button>
            )}
          </div>

          <div className="mb-2 flex items-center">
            <h3 className="text-xl font-semibold">{getUserFullName(user)}</h3>
            <Badge variant="secondary" className="ml-2">
              Verified
            </Badge>
          </div>

          <div className="text-muted-foreground mb-4 flex items-center text-sm">
            <MapPin className="mr-1 h-4 w-4" />
            <span>
              {getUserCity(user.primaryAddress)},{" "}
              {getUserState(user.primaryAddress)}
            </span>
          </div>

          <div className="mb-4 flex items-center">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${star <= 4 ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                />
              ))}
            </div>
            <span className="ml-2 text-sm">4.8 (28 reviews)</span>
          </div>

          <div className="text-muted-foreground mb-4 text-center text-sm">
            <div className="flex items-center">
              <Calendar className="mr-1 h-4 w-4" />
              <span>Member since May 2022</span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid w-full grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">32</div>
              <div className="text-muted-foreground text-xs">
                Tools Borrowed
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">18</div>
              <div className="text-muted-foreground text-xs">Tools Shared</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                {renderField(
                  "firstName",
                  <Input {...form.register("firstName")} />,
                  user.firstName,
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                {renderField(
                  "lastName",
                  <Input {...form.register("lastName")} />,
                  user.lastName,
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {renderField(
                "email",
                <Input type="email" {...form.register("email")} />,
                user.email,
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              {renderField(
                "phone",
                <Input type="tel" {...form.register("phone")} />,
                user.phone || "",
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Street</Label>
              {renderField(
                "address.street",
                <Input {...form.register("address.street")} />,
                user.primaryAddress?.street || "",
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                {renderField(
                  "address.city",
                  <Input {...form.register("address.city")} />,
                  user.primaryAddress?.city || "",
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                {renderField(
                  "address.state",
                  <Input {...form.register("address.state")} />,
                  user.primaryAddress?.state || "",
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                {renderField(
                  "address.zipCode",
                  <Input {...form.register("address.zipCode")} />,
                  user.primaryAddress?.zipCode || "",
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
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
        </CardContent>
      </Card>
    </div>
  );
}
