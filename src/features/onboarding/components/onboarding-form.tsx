"use client";

import { useState, useActionState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { validateField } from "../schemas/validation";
import type { OnboardingData } from "../schemas/validation";
import { onboardingAction } from "../actions/onboarding-action";
import { ProfileImageUpload } from "./profile-image-upload";

interface OnboardingFormProps {
  communityName?: string;
  profileImageUrl?: string;
  userFirstName?: string;
  userLastName?: string;
}

export function OnboardingForm({
  communityName = "Your Community",
  profileImageUrl = "",
  userFirstName = "",
  userLastName = "",
}: OnboardingFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [state, formAction, isPending] = useActionState(onboardingAction, null);

  // Navigate to dashboard on successful onboarding
  useEffect(() => {
    if (state?.success && !state?.error) {
      // Small delay to ensure state updates are complete
      router.push("/dashboard");
    }
  }, [state?.success, state?.error, router]);

  // Form state
  const [formData, setFormData] = useState({
    firstName: userFirstName && userFirstName !== "User" ? userFirstName : "",
    lastName: userLastName,
    phone: "",
    bio: "",
    profileImageUrl,
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    },
    agreeToTerms: false,
  });

  // ---------------------------
  // Helper for per-field validation (only runs after first submit attempt)
  // ---------------------------
  const handleFieldValidation = (
    field: keyof OnboardingData | `address.${keyof OnboardingData["address"]}`,
    value: unknown,
  ) => {
    if (!hasAttemptedSubmit || state?.success) return; // Only validate after first submit attempt

    const error = validateField(
      field as Parameters<typeof validateField>[0],
      value,
    );
    setErrors((prev) => ({ ...prev, [field]: error || "" }));
  };

  // ---------------------------
  // Generic change handlers
  // ---------------------------
  const handleChange = (
    field: keyof Omit<OnboardingData, "address">,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    handleFieldValidation(field, value);
  };

  const handleAddressChange = (
    field: keyof OnboardingData["address"],
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
    handleFieldValidation(`address.${field}`, value);
  };

  // ---------------------------
  // Form validation
  // ---------------------------
  const validateAllFields = (): boolean => {
    const fieldsToValidate = [
      { field: "firstName", value: formData.firstName },
      { field: "lastName", value: formData.lastName },
      { field: "phone", value: formData.phone },
      { field: "bio", value: formData.bio },
      { field: "profileImageUrl", value: formData.profileImageUrl },
      { field: "address.street", value: formData.address.street },
      { field: "address.city", value: formData.address.city },
      { field: "address.state", value: formData.address.state },
      { field: "address.zipCode", value: formData.address.zipCode },
      { field: "agreeToTerms", value: formData.agreeToTerms },
    ] as const;

    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    fieldsToValidate.forEach(({ field, value }) => {
      const error = validateField(
        field as Parameters<typeof validateField>[0],
        value,
      );
      if (error) {
        newErrors[field] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  // Check if all required fields are filled (for button state)
  const isFormComplete = Boolean(
    formData.firstName?.trim() &&
      formData.lastName?.trim() &&
      formData.phone?.trim() &&
      formData.address.street?.trim() &&
      formData.address.city?.trim() &&
      formData.address.state?.trim() &&
      formData.address.zipCode?.trim() &&
      formData.agreeToTerms,
  );

  // ---------------------------
  // Form submission handler
  // ---------------------------
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // Don't validate if already successful (prevents state reset during redirect)
    if (state?.success) {
      return;
    }

    // Don't validate if currently submitting
    if (isPending) {
      event.preventDefault();
      return;
    }

    setHasAttemptedSubmit(true);

    // Validate all fields
    const isValid = validateAllFields();

    if (!isValid) {
      event.preventDefault();
      return;
    }

    // Form is valid, let it submit naturally to the server action
  };

  // Generate user initials for profile image
  const userInitials =
    `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase();

  // Show success/error messages from server action
  // TODO: Add toast notifications when useToast is available

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-24">
      <Link href="/" className="flex items-center justify-center gap-2">
        <Image
          src="/hoador-logo.svg"
          alt="Hoador Logo"
          width={100}
          height={40}
          className="h-6 w-auto"
          priority
        />
      </Link>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center justify-center gap-2">
            <CheckCircle className="text-primary h-5 w-5" />
            <span className="text-primary text-sm font-medium">
              {communityName}
            </span>
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Enter your information to finish setting up your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={formAction}
            onSubmit={handleFormSubmit}
            className="space-y-6"
          >
            {/* Profile Image Upload */}
            <div className="flex flex-col items-center space-y-2">
              <Label className="text-center">Profile Photo (Optional)</Label>
              <ProfileImageUpload
                currentImageUrl={formData.profileImageUrl || undefined}
                onImageChange={(url) =>
                  handleChange("profileImageUrl", url || "")
                }
                disabled={isPending}
                userInitials={userInitials}
              />
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First name *</Label>
                <Input
                  id="first-name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className={errors.firstName ? "border-red-500" : ""}
                  disabled={isPending}
                />
                {errors.firstName && (
                  <p className="text-xs text-red-500">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last name *</Label>
                <Input
                  id="last-name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className={errors.lastName ? "border-red-500" : ""}
                  disabled={isPending}
                />
                {errors.lastName && (
                  <p className="text-xs text-red-500">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
                disabled={isPending}
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">
                Bio (Optional)
                <span className="ml-2 text-xs text-gray-500">
                  {formData.bio.length}/200
                </span>
              </Label>
              <Textarea
                id="bio"
                name="bio"
                placeholder="Tell us a bit about yourself..."
                value={formData.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                className={errors.bio ? "border-red-500" : ""}
                disabled={isPending}
                maxLength={200}
                rows={3}
              />
              {errors.bio && (
                <p className="text-xs text-red-500">{errors.bio}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Address *</Label>

              <div className="space-y-2">
                <Label htmlFor="street">Street address</Label>
                <Input
                  id="street"
                  name="street"
                  placeholder="Enter your street address"
                  value={formData.address.street}
                  onChange={(e) =>
                    handleAddressChange("street", e.target.value)
                  }
                  className={errors["address.street"] ? "border-red-500" : ""}
                  disabled={isPending}
                />
                {errors["address.street"] && (
                  <p className="text-xs text-red-500">
                    {errors["address.street"]}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.address.city}
                    onChange={(e) =>
                      handleAddressChange("city", e.target.value)
                    }
                    className={errors["address.city"] ? "border-red-500" : ""}
                    disabled={isPending}
                  />
                  {errors["address.city"] && (
                    <p className="text-xs text-red-500">
                      {errors["address.city"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    maxLength={2}
                    placeholder="CA"
                    value={formData.address.state}
                    onChange={(e) =>
                      handleAddressChange("state", e.target.value.toUpperCase())
                    }
                    className={errors["address.state"] ? "border-red-500" : ""}
                    disabled={isPending}
                  />
                  {errors["address.state"] && (
                    <p className="text-xs text-red-500">
                      {errors["address.state"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP code</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    placeholder="12345"
                    value={formData.address.zipCode}
                    onChange={(e) =>
                      handleAddressChange("zipCode", e.target.value)
                    }
                    className={
                      errors["address.zipCode"] ? "border-red-500" : ""
                    }
                    disabled={isPending}
                  />
                  {errors["address.zipCode"] && (
                    <p className="text-xs text-red-500">
                      {errors["address.zipCode"]}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                name="agreeToTerms"
                className="mt-1"
                checked={formData.agreeToTerms || isPending || state?.success}
                onCheckedChange={(checked) => {
                  const booleanValue = checked === true;
                  handleChange("agreeToTerms", booleanValue);
                }}
                disabled={isPending}
              />
              <label
                htmlFor="terms"
                className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  terms of service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  privacy policy
                </Link>
              </label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-xs text-red-500">{errors.agreeToTerms}</p>
            )}

            {/* Hidden field for profile image URL */}
            <input
              type="hidden"
              name="profileImageUrl"
              value={formData.profileImageUrl}
            />

            {/* Server Error Display */}
            {state?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{state.error}</p>
              </div>
            )}

            {/* Success/Warning Display */}
            {state?.success && state?.warning && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-700">{state.warning}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isFormComplete || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing Profile...
                </>
              ) : (
                "Complete Profile"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4">
          <div className="text-muted-foreground text-center text-sm">
            Need help?{" "}
            <Link href="/support" className="text-primary hover:underline">
              Contact support
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
