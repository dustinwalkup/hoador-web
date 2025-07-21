import type { UserProfile } from "@/lib/dal/types";

export function getUserFullName(
  user: Pick<UserProfile, "firstName" | "lastName">,
) {
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  return `${firstName} ${lastName}`.trim();
}

export function getUserInitials(
  user: Pick<UserProfile, "firstName" | "lastName">,
) {
  const firstInitial = user.firstName ? user.firstName[0] : "";
  const lastInitial = user.lastName ? user.lastName[0] : "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
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

export function formatMemberSince(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return "Member since Unknown";

  const month = d.toLocaleString("default", { month: "long" });
  const year = d.getFullYear();

  return `Member since ${month} ${year}`;
}
