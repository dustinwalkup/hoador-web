import { isOwnBlobUrl } from "@/services/vercel-blob";

/**
 * Whether `url` is one of this user's own avatar blobs (SEC-11). The profile
 * and onboarding writes accept only these, so a client can't point its
 * `profileImageUrl` at someone else's blob and then DELETE it.
 */
export function isOwnProfileImagePath(url: string, userId: string): boolean {
  return isOwnBlobUrl(url, `profiles/${userId}/`);
}
