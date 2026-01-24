"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { ProfileImageUpload } from "@/features/onboarding/components/profile-image-upload";
import { useUpdateProfileImage } from "@/features/users/hooks/use-profile-mutations";
import { getUserInitials } from "@/features/users/utils/users.utils";
import type { UserProfile } from "@/dal/types";

interface ProfileImageSectionProps {
  user: UserProfile;
}

export function ProfileImageSection({ user }: ProfileImageSectionProps) {
  const updateProfileImage = useUpdateProfileImage();
  const [currentImageUrl, setCurrentImageUrl] = useState(
    user.profileImageUrl || user.image,
  );

  const handleImageChange = (newImageUrl: string | null) => {
    // Only handle new image uploads, ignore null/delete requests
    if (!newImageUrl) return;

    // Optimistic update - show new image immediately
    setCurrentImageUrl(newImageUrl);

    // Update database
    updateProfileImage.mutate(newImageUrl, {
      onError: () => {
        // Revert optimistic update on failure
        setCurrentImageUrl(user.profileImageUrl || user.image);
      },
    });
  };

  return (
    <div className="relative mb-4">
      {updateProfileImage.isPending ? (
        // Loading state during database update - replace image with spinner
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        // Normal state - show ProfileImageUpload component
        <ProfileImageUpload
          currentImageUrl={currentImageUrl || undefined}
          onImageChange={handleImageChange}
          disabled={updateProfileImage.isPending}
          userInitials={getUserInitials(user)}
          showRemoveButton={false}
          showToasts={false}
        />
      )}
    </div>
  );
}
