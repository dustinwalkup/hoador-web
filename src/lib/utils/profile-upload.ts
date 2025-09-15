// Profile image upload utilities
export interface ProfileUploadResponse {
  success: boolean;
  url: string;
  pathname: string;
  metadata: {
    originalSize: number;
    processedSize: number;
    dimensions: string;
    compressionRatio: string;
  };
}

export interface ProfileUploadError {
  success: false;
  error: string;
}

export interface ProfileDeleteResponse {
  success: boolean;
  message: string;
}

export interface ProfileDeleteError {
  success: false;
  error: string;
}

// Client-side upload utilities
export async function uploadProfileImage(
  file: File,
): Promise<ProfileUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/profile/upload", {
    method: "POST",
    body: formData,
  });

  // Check if response is HTML (authentication redirect)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("Authentication required. Please log in and try again.");
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Invalid response from server. Please try again.");
  }

  if (!response.ok) {
    throw new Error(result.error || "Failed to upload profile image");
  }

  return result;
}

export async function deleteProfileImage(
  pathname: string,
): Promise<ProfileDeleteResponse> {
  const response = await fetch(
    `/api/profile/upload?pathname=${encodeURIComponent(pathname)}`,
    {
      method: "DELETE",
    },
  );

  // Check if response is HTML (authentication redirect)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("Authentication required. Please log in and try again.");
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Invalid response from server. Please try again.");
  }

  if (!response.ok) {
    throw new Error(result.error || "Failed to delete profile image");
  }

  return result;
}
