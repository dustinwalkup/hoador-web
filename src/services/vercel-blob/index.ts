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

/**
 * The blob pathname (no leading slash) that `url` points at — the form
 * `deleteFromBlob` takes. Throws on a malformed URL.
 */
export function pathnameFromBlobUrl(url: string): string {
  return new URL(url).pathname.slice(1);
}

/**
 * True only for an https URL on a Vercel Blob store whose pathname starts with
 * `prefix`. Checking the pathname alone isn't enough, because
 * `https://evil.example/profiles/<id>/x.png` has the same pathname — the
 * tracking-pixel case (SEC-22). Any `*.public.blob.vercel-storage.com` host is
 * accepted rather than pinning our two store ids: another store can't hold a
 * blob under *this* user's or rental's prefix by accident, and a deliberate one
 * only affects the attacker's own avatar or evidence. Never throws.
 */
export function isOwnBlobUrl(url: string, prefix: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.slice(1).startsWith(prefix)
    );
  } catch {
    return false;
  }
}
