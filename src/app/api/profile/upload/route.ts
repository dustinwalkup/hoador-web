import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { uploadToBlob, deleteFromBlob } from "@/services/vercel-blob";
import {
  handleApiError,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import {
  processImageForUpload,
  validateImageForProcessing,
  getImageMetadata,
} from "@/lib/image/server";

/**
 * POST /api/profile/upload
 * Upload a profile image
 */
async function postHandler(request: NextRequest) {
  try {
    // Authenticate - ALWAYS use getAuthenticatedUserResponse()
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { user } = authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file (5MB max for profile images)
    const validationError = validateImageForProcessing(file, 5);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Get original metadata for logging
    const originalMetadata = await getImageMetadata(buffer);
    console.log(`Processing profile image: ${file.name}`, {
      originalSize: `${(originalMetadata.size / (1024 * 1024)).toFixed(2)}MB`,
      originalDimensions: `${originalMetadata.width}x${originalMetadata.height}`,
      originalFormat: originalMetadata.format,
    });

    // Process image for profile (400x400px, JPEG, 85% quality)
    const processedBuffer = await processImageForUpload(buffer, {
      maxWidth: 400,
      maxHeight: 400,
      quality: 85,
      format: "jpeg",
    });

    // Get processed metadata
    const processedMetadata = await getImageMetadata(processedBuffer);
    console.log(`Processed profile image: ${file.name}`, {
      processedSize: `${(processedMetadata.size / (1024 * 1024)).toFixed(2)}MB`,
      processedDimensions: `${processedMetadata.width}x${processedMetadata.height}`,
      compressionRatio: `${((1 - processedMetadata.size / originalMetadata.size) * 100).toFixed(1)}%`,
    });

    // Generate unique filename with .jpg extension
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `profiles/${timestamp}-${sanitizedName.replace(/\.[^/.]+$/, ".jpg")}`;

    // Get current user's profile image before upload (for cleanup)
    const currentProfileImageUrl = user.profileImageUrl;

    // Upload processed image to Vercel Blob
    const blob = await uploadToBlob(filename, processedBuffer);

    // Background cleanup: delete old profile image if it exists
    if (currentProfileImageUrl) {
      try {
        const oldImageUrl = new URL(currentProfileImageUrl);
        const oldPathname = oldImageUrl.pathname.substring(1); // Remove leading slash

        if (oldPathname.startsWith("profiles/")) {
          // Don't await this - run in background
          deleteFromBlob(oldPathname).catch((error) => {
            console.warn(
              "Failed to delete old profile image:",
              oldPathname,
              error,
            );
          });
        }
      } catch (error) {
        console.warn(
          "Failed to parse old profile image URL for cleanup:",
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      metadata: {
        originalSize: originalMetadata.size,
        processedSize: processedMetadata.size,
        dimensions: `${processedMetadata.width}x${processedMetadata.height}`,
        compressionRatio: `${((1 - processedMetadata.size / originalMetadata.size) * 100).toFixed(1)}%`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/profile/upload");

async function deleteHandler(request: NextRequest) {
  try {
    // Authenticate - ALWAYS use getAuthenticatedUserResponse()
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }

    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname");

    if (!pathname) {
      return NextResponse.json(
        { error: "Pathname is required" },
        { status: 400 },
      );
    }

    // Validate that this is a profile image path
    if (!pathname.startsWith("profiles/")) {
      return NextResponse.json(
        { error: "Invalid profile image path" },
        { status: 400 },
      );
    }

    await deleteFromBlob(pathname);

    return NextResponse.json({
      success: true,
      message: "Profile image deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/profile/upload",
);
