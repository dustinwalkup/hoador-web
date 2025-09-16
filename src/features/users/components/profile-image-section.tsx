"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { ProfileImageUpload } from "@/features/onboarding/components/profile-image-upload";
import { updateProfileImageAction } from "@/features/users/actions/update-profile-image";
import { getUserInitials } from "@/features/users/utils/users.utils";
import type { UserProfile } from "@/dal/types";

interface ProfileImageSectionProps {
  user: UserProfile;
}

export function ProfileImageSection({ user }: ProfileImageSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [currentImageUrl, setCurrentImageUrl] = useState(user.profileImageUrl);

  const handleImageChange = (newImageUrl: string | null) => {
    // Only handle new image uploads, ignore null/delete requests
    if (!newImageUrl) return;

    // Optimistic update - show new image immediately
    setCurrentImageUrl(newImageUrl);

    // Update database
    startTransition(async () => {
      try {
        const result = await updateProfileImageAction(newImageUrl);

        if (!result.success) {
          // Revert optimistic update on failure
          setCurrentImageUrl(user.profileImageUrl);
          toast.error(result.error || "Failed to update profile image");
        } else {
          toast.success("Profile image updated successfully");
        }
      } catch (error) {
        // Revert optimistic update on failure
        setCurrentImageUrl(user.profileImageUrl);
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <div className="relative mb-4">
      {isPending ? (
        // Loading state during database update - replace image with spinner
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        // Normal state - show ProfileImageUpload component
        <ProfileImageUpload
          currentImageUrl={currentImageUrl || undefined}
          onImageChange={handleImageChange}
          disabled={isPending}
          userInitials={getUserInitials(user)}
          showRemoveButton={false}
          showToasts={false}
        />
      )}
    </div>
  );
}
