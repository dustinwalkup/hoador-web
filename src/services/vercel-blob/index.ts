import { put, del } from "@vercel/blob";

export interface BlobUploadResult {
  url: string;
  pathname: string;
}

/**
 * Upload a file to Vercel Blob storage
 */
export async function uploadToBlob(
  filename: string,
  file: File | Buffer,
): Promise<BlobUploadResult> {
  const blob = await put(filename, file, {
    access: "public",
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteFromBlob(pathname: string): Promise<void> {
  await del(pathname);
}
