"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  uploadProfileImage,
  deleteProfileImage,
} from "@/lib/utils/profile-upload";

interface ProfileImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (url: string | null) => void;
  disabled?: boolean;
  userInitials: string; // e.g., "JD" for John Doe
  showRemoveButton?: boolean; // Whether to show the X remove button
  showToasts?: boolean; // Whether to show success/error toasts
}

export function ProfileImageUpload({
  currentImageUrl,
  onImageChange,
  disabled = false,
  userInitials,
  showRemoveButton = true,
  showToasts = true,
}: ProfileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInProgressRef = useRef(false);

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    // Check file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return "Please select a valid image file (JPEG, PNG, or WebP)";
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return "Image must be smaller than 5MB";
    }

    return null;
  };

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (uploadInProgressRef.current) return;

      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        if (showToasts) {
          toast.error(validationError);
        }
        return;
      }

      uploadInProgressRef.current = true;
      setIsUploading(true);
      setUploadError(null);

      try {
        const result = await uploadProfileImage(file);
        onImageChange(result.url);
        if (showToasts) {
          toast.success("Profile image uploaded successfully");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to upload image";
        setUploadError(errorMessage);
        if (showToasts) {
          toast.error(errorMessage);
        }
      } finally {
        uploadInProgressRef.current = false;
        setIsUploading(false);
      }
    },
    [onImageChange, showToasts],
  );

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Handle remove image
  const handleRemoveImage = async () => {
    if (!currentImageUrl) return;

    try {
      // Extract pathname from URL for deletion
      const url = new URL(currentImageUrl);
      const pathname = url.pathname.substring(1); // Remove leading slash

      if (pathname.startsWith("profiles/")) {
        await deleteProfileImage(pathname);
      }

      onImageChange(null);
      setUploadError(null);
      if (showToasts) {
        toast.success("Profile image removed");
      }
    } catch (error) {
      console.warn("Failed to delete image from storage:", error);
      // Still remove from form even if deletion fails
      onImageChange(null);
      setUploadError(null);
    }
  };

  // Handle retry upload
  const handleRetry = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  // Handle click to browse
  const handleBrowseClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Upload Area */}
      <div
        className={`relative flex h-32 w-32 cursor-pointer items-center justify-center rounded-full border-2 border-dashed transition-all ${isDragOver ? "border-primary bg-primary/5" : "border-gray-300"} ${disabled || isUploading ? "cursor-not-allowed opacity-50" : "hover:border-primary hover:bg-gray-50"} ${uploadError ? "border-red-300 bg-red-50" : ""} `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        {/* Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/80">
            <RefreshCw className="text-primary h-6 w-6 animate-spin" />
          </div>
        )}

        {/* Current Image */}
        {currentImageUrl && !uploadError ? (
          <Image
            src={currentImageUrl}
            height={128}
            width={128}
            alt="Profile"
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          /* Default State - Initials or Upload Icon */
          <div className="flex flex-col items-center space-y-2">
            {uploadError ? (
              <>
                <AlertCircle className="h-8 w-8 text-red-500" />
                <span className="text-xs text-red-600">Upload Failed</span>
              </>
            ) : userInitials ? (
              <>
                <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold">
                  {userInitials}
                </div>
                <span className="text-xs text-gray-500">Add Photo</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-500">Upload Photo</span>
              </>
            )}
          </div>
        )}

        {/* Remove Button */}
        {currentImageUrl && !isUploading && showRemoveButton && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Error Message & Retry */}
      {uploadError && (
        <div className="flex flex-col items-center space-y-2">
          <p className="text-sm text-red-600">{uploadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={disabled || isUploading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      {/* Upload Instructions */}
      {!currentImageUrl && !uploadError && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Drag and drop or click to browse
          </p>
          <p className="text-xs text-gray-500">
            JPEG, PNG, WebP • Max 5MB • 400x400px recommended
          </p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  );
}
