import type { UserProfile } from "@/lib/dal/types";

export function getUserFullName(
  user: Pick<UserProfile, "firstName" | "lastName">,
) {
  return `${user.firstName} ${user.lastName}`;
}

export function getUserInitials(
  user: Pick<UserProfile, "firstName" | "lastName">,
) {
  return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
}

export function isVerified(
  user: Pick<UserProfile, "emailVerified" | "idVerified" | "addressVerified">,
) {
  return user.emailVerified && user.idVerified && user.addressVerified;
}

export function getUserStreet(address?: UserProfile["primaryAddress"]): string {
  return address?.street ?? "";
}

export function getUserCity(address?: UserProfile["primaryAddress"]): string {
  return address?.city ?? "";
}

export function getUserState(address?: UserProfile["primaryAddress"]): string {
  return address?.state ?? "";
}

export function getUserZip(address?: UserProfile["primaryAddress"]): string {
  return address?.zipCode ?? "";
}

export function getFullAddress(
  address?: UserProfile["primaryAddress"],
): string {
  const parts = [
    getUserStreet(address),
    getUserCity(address),
    getUserState(address),
    getUserZip(address),
  ];
  return parts.filter(Boolean).join(", ");
}
