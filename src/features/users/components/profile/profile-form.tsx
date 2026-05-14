"use client";

import { JSX, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Edit3, Save, X, Check } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUpdateUserProfile } from "@/features/users/hooks/use-profile-mutations";
import { PROFILE_OVERVIEW, US_STATES } from "@/constants/profile";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserProfile } from "@/dal/types";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ProfileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z
    .string()
    .min(10, "Phone number is required")
    .refine((val) => !val || /^\d{10}$/.test(val.replace(/\D/g, "")), {
      message: "Please enter a valid 10-digit phone number",
    }),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  address: z.object({
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z
      .string()
      .min(4, "Zip code must be at least 4 characters")
      .max(10, "Zip code must be 10 characters or less"),
  }),
});

export type FormData = z.infer<typeof ProfileFormSchema>;

// Phone formatting utility
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const phoneNumber = value.replace(/\D/g, "");

  // Apply formatting based on length
  if (phoneNumber.length < 4) return phoneNumber;
  if (phoneNumber.length < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

// Custom phone input component
interface PhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Custom phone input component
const PhoneInput = ({ value, onChange, onBlur, ...props }: PhoneInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedValue = formatPhoneNumber(inputValue);

    // Update the input display
    e.target.value = formattedValue;

    // Pass the unformatted number to the form
    const unformattedValue = formattedValue.replace(/\D/g, "");
    onChange(unformattedValue);
  };

  const displayValue = value ? formatPhoneNumber(value) : "";

  return (
    <Input
      {...props}
      type="tel"
      value={displayValue}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder="(555) 123-4567"
      maxLength={14}
    />
  );
};

export function ProfileForm({ user }: { user: UserProfile }) {
  const [editMode, setEditMode] = useState(false);
  const router = useRouter();
  const updateProfile = useUpdateUserProfile();

  const form = useForm<FormData>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
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
    updateProfile.mutate(data, {
      onSuccess: () => {
        setEditMode(false);
        router.refresh();
      },
    });
  };

  const handleCancel = () => {
    form.reset();
    setEditMode(false);
  };

  const renderField = (id: string, content: JSX.Element, value: string) =>
    editMode ? (
      content
    ) : (
      <div
        className={cn(
          "overflow-hidden px-3 py-[7px] text-sm",
          id === "bio" && "pt-[8px] pb-[14px]",
        )}
      >
        {value}
      </div>
    );

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return "Not provided";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <Card className={cn(editMode && "border-primary bg-green-50/5")}>
      <div className="flex items-center justify-between gap-2">
        <CardHeader className="flex-1 pr-0">
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {PROFILE_OVERVIEW.formCard.title}{" "}
            </div>
          </CardTitle>
          <CardDescription>
            {PROFILE_OVERVIEW.formCard.description}
          </CardDescription>
        </CardHeader>
        {/* Top-level action buttons */}
        <div className="relative flex items-center">
          {!editMode ? (
            /* Edit button (when not in edit mode) */
            <div className="animate-in fade-in-0 slide-in-from-right-4 transition-all duration-500 ease-in-out">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditMode(true)}
                className="text-primary h-12 w-12 p-0 transition-all duration-300 ease-in-out hover:scale-105 hover:bg-transparent dark:hover:bg-transparent"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Save and Cancel buttons (when in edit mode) */
            <div className="animate-in fade-in-0 slide-in-from-right-4 flex gap-2 transition-all duration-500 ease-in-out">
              <Button
                type="submit"
                variant="ghost"
                aria-label="Save"
                disabled={updateProfile.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  form.handleSubmit(handleSubmit)();
                }}
                className="text-primary focus-visible:ring-primary inline-flex h-12 w-12 items-center justify-center rounded-md bg-transparent p-0 transition-all duration-300 ease-in-out hover:scale-120 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label="Cancel"
                size="sm"
                onClick={handleCancel}
                className="focus-visible:ring-primary h-12 w-12 p-0 text-red-600 transition-all duration-300 ease-in-out hover:scale-120 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-red-400 dark:hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <CardContent>
        <div className="mx-auto max-w-4xl">
          <div className="space-y-6">
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  if (!editMode) {
                    e.preventDefault();
                    return;
                  }
                  form.handleSubmit(handleSubmit)(e);
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="firstName"
                      className={`transition-all duration-300 ease-in-out`}
                    >
                      {PROFILE_OVERVIEW.formCard.fields.firstName}
                    </Label>
                    {renderField(
                      "firstName",
                      <div>
                        <Input
                          {...form.register("firstName")}
                          className="focus:border-primary border-primary dark:border-primary transform bg-white transition-all duration-600 ease-in-out focus:scale-[1.02]"
                        />
                        {form.formState.errors.firstName && (
                          <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                            {form.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>,
                      user.firstName || "",
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="lastName"
                      className={`transition-all duration-300 ease-in-out`}
                    >
                      {PROFILE_OVERVIEW.formCard.fields.lastName}
                    </Label>
                    {renderField(
                      "lastName",
                      <div>
                        <Input
                          {...form.register("lastName")}
                          className="border-primary transform transition-all duration-300 ease-in-out focus:scale-[1.02]"
                        />
                        {form.formState.errors.lastName && (
                          <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                            {form.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>,
                      user.lastName || "",
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className={`transition-all duration-300 ease-in-out`}
                    >
                      {PROFILE_OVERVIEW.formCard.fields.email}
                    </Label>
                    {renderField(
                      "email",
                      <div>
                        <Input
                          {...form.register("email")}
                          type="email"
                          disabled
                          className="bg-muted transition-all duration-300 ease-in-out"
                        />
                        {form.formState.errors.email && (
                          <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                            {form.formState.errors.email.message}
                          </p>
                        )}
                      </div>,
                      user.email,
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className={`transition-all duration-300 ease-in-out`}
                    >
                      {PROFILE_OVERVIEW.formCard.fields.phone}
                    </Label>
                    {renderField(
                      "phone",
                      <div>
                        <Controller
                          name="phone"
                          control={form.control}
                          render={({ field }) => (
                            <PhoneInput
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              className="border-primary transform transition-all duration-300 ease-in-out focus:scale-[1.02]"
                            />
                          )}
                        />
                        {form.formState.errors.phone && (
                          <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                            {form.formState.errors.phone.message}
                          </p>
                        )}
                      </div>,
                      formatPhoneDisplay(user.phone || ""),
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="bio"
                    className={`transition-all duration-300 ease-in-out`}
                  >
                    {PROFILE_OVERVIEW.formCard.fields.bio}
                  </Label>
                  {renderField(
                    "bio",
                    <div>
                      <Textarea
                        {...form.register("bio")}
                        rows={3}
                        className="border-primary transform transition-all duration-300 ease-in-out focus:scale-[1.01]"
                      />
                      {form.formState.errors.bio && (
                        <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                          {form.formState.errors.bio.message}
                        </p>
                      )}
                    </div>,
                    user.bio || "No bio provided",
                  )}
                </div>

                {/* Address Information Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="flex items-center gap-2 text-base font-medium">
                    Address Information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="street"
                        className={`transition-all duration-300 ease-in-out`}
                      >
                        {PROFILE_OVERVIEW.formCard.fields.street}
                      </Label>
                      {renderField(
                        "street",
                        <div>
                          <Input
                            {...form.register("address.street")}
                            className="border-primary transform transition-all duration-300 ease-in-out focus:scale-[1.02]"
                          />
                          {form.formState.errors.address?.street && (
                            <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                              {form.formState.errors.address.street.message}
                            </p>
                          )}
                        </div>,
                        user.primaryAddress?.street || "Not provided",
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="city"
                        className={`transition-all duration-300 ease-in-out`}
                      >
                        {PROFILE_OVERVIEW.formCard.fields.city}
                      </Label>
                      {renderField(
                        "city",
                        <div>
                          <Input
                            {...form.register("address.city")}
                            className="border-primary transform transition-all duration-300 ease-in-out focus:scale-[1.02] focus:border-blue-500 focus:ring-blue-500 dark:border-blue-800"
                          />
                          {form.formState.errors.address?.city && (
                            <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                              {form.formState.errors.address.city.message}
                            </p>
                          )}
                        </div>,
                        user.primaryAddress?.city || "Not provided",
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="state"
                        className={`transition-all duration-300 ease-in-out`}
                      >
                        {PROFILE_OVERVIEW.formCard.fields.state}
                      </Label>
                      {renderField(
                        "state",
                        <div>
                          <Controller
                            name="address.state"
                            control={form.control}
                            render={({ field }) => (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="border-primary w-full transform transition-all duration-300 ease-in-out focus:scale-[1.02]">
                                  <SelectValue placeholder="Select a state" />
                                </SelectTrigger>
                                <SelectContent>
                                  {US_STATES.map((state) => (
                                    <SelectItem
                                      key={state.value}
                                      value={state.value}
                                    >
                                      {state.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {form.formState.errors.address?.state && (
                            <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                              {form.formState.errors.address.state.message}
                            </p>
                          )}
                        </div>,
                        user.primaryAddress?.state
                          ? US_STATES.find(
                              (state) =>
                                state.value === user.primaryAddress?.state,
                            )?.label || user.primaryAddress.state
                          : "Not provided",
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="zipCode"
                        className={`transition-all duration-300 ease-in-out`}
                      >
                        {PROFILE_OVERVIEW.formCard.fields.zipCode}
                      </Label>
                      {renderField(
                        "zipCode",
                        <div>
                          <Input
                            {...form.register("address.zipCode")}
                            className="border-primary transform transition-all duration-300 ease-in-out focus:scale-[1.02]"
                          />
                          {form.formState.errors.address?.zipCode && (
                            <p className="animate-in slide-in-from-top-1 mt-1 text-sm text-red-500 duration-300">
                              {form.formState.errors.address.zipCode.message}
                            </p>
                          )}
                        </div>,
                        user.primaryAddress?.zipCode || "Not provided",
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`flex gap-3 transition-all duration-500 ease-in-out dark:border-blue-800 ${
                    editMode
                      ? "h-9 translate-y-0 transform opacity-100"
                      : "pointer-events-none h-0 translate-y-4 transform opacity-0"
                  }`}
                >
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="bg-primary border-primary/20 hover:bg-primary focus-visible:ring-primary hover:border-primary inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-white transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                    {updateProfile.isPending ? "Saving..." : "Save Changes"}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30 focus-visible:ring-primary/50 flex items-center gap-2 bg-transparent transition-all duration-300 ease-in-out hover:scale-105"
                  >
                    <X className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                    Cancel
                  </Button>
                </div>
              </form>

              <div
                className={`flex gap-2 transition-all duration-500 ease-in-out ${
                  !editMode
                    ? "h-9 translate-y-0 transform opacity-100"
                    : "pointer-events-none h-0 translate-y-4 transform opacity-0"
                }`}
              >
                <Button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg"
                >
                  <Edit3 className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
