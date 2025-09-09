import { describe, it, expect } from "vitest";
import type { UserProfile } from "@/dal/types";
import {
  getUserFullName,
  getUserInitials,
  isVerified,
  getUserStreet,
  getUserCity,
  getUserState,
  getUserZip,
  getFullAddress,
  formatMemberSince,
} from "../users.utils";

describe("users.utils", () => {
  const mockUser: Pick<UserProfile, "firstName" | "lastName"> = {
    firstName: "John",
    lastName: "Doe",
  };

  const mockUserWithEmptyNames: Pick<UserProfile, "firstName" | "lastName"> = {
    firstName: "",
    lastName: "",
  };

  const mockVerifiedUser: Pick<
    UserProfile,
    "emailVerified" | "idVerified" | "addressVerified"
  > = {
    emailVerified: true,
    idVerified: true,
    addressVerified: true,
  };

  const mockUnverifiedUser: Pick<
    UserProfile,
    "emailVerified" | "idVerified" | "addressVerified"
  > = {
    emailVerified: false,
    idVerified: false,
    addressVerified: false,
  };

  const mockPartiallyVerifiedUser: Pick<
    UserProfile,
    "emailVerified" | "idVerified" | "addressVerified"
  > = {
    emailVerified: true,
    idVerified: false,
    addressVerified: true,
  };

  const mockAddress: UserProfile["primaryAddress"] = {
    id: "addr-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-1",
    street: "123 Main St",
    city: "Anytown",
    state: "CA",
    zipCode: "12345",
    country: "US",
    latitude: null,
    longitude: null,
    isPrimary: true,
  };

  const mockPartialAddress: UserProfile["primaryAddress"] = {
    id: "addr-2",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-1",
    street: "123 Main St",
    city: "Anytown",
    state: "",
    zipCode: "",
    country: "US",
    latitude: null,
    longitude: null,
    isPrimary: true,
  };

  const mockEmptyAddress: UserProfile["primaryAddress"] = {
    id: "addr-3",
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-1",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
    latitude: null,
    longitude: null,
    isPrimary: true,
  };

  describe("getUserFullName", () => {
    it("should return full name when both names are provided", () => {
      expect(getUserFullName(mockUser)).toBe("John Doe");
    });

    it("should handle empty first name", () => {
      const user = { firstName: "", lastName: "Doe" };
      expect(getUserFullName(user)).toBe(" Doe");
    });

    it("should handle empty last name", () => {
      const user = { firstName: "John", lastName: "" };
      expect(getUserFullName(user)).toBe("John ");
    });

    it("should handle both names empty", () => {
      expect(getUserFullName(mockUserWithEmptyNames)).toBe(" ");
    });

    it("should handle names with spaces", () => {
      const user = { firstName: "John Michael", lastName: "Doe Smith" };
      expect(getUserFullName(user)).toBe("John Michael Doe Smith");
    });

    it("should handle single character names", () => {
      const user = { firstName: "J", lastName: "D" };
      expect(getUserFullName(user)).toBe("J D");
    });

    it("should handle names with special characters", () => {
      const user = { firstName: "José", lastName: "O'Connor" };
      expect(getUserFullName(user)).toBe("José O'Connor");
    });

    it("should handle names with numbers", () => {
      const user = { firstName: "John2", lastName: "Doe3" };
      expect(getUserFullName(user)).toBe("John2 Doe3");
    });
  });

  describe("getUserInitials", () => {
    it("should return initials when both names are provided", () => {
      expect(getUserInitials(mockUser)).toBe("JD");
    });

    it("should handle empty first name", () => {
      const user = { firstName: "", lastName: "Doe" };
      expect(getUserInitials(user)).toBe("D");
    });

    it("should handle empty last name", () => {
      const user = { firstName: "John", lastName: "" };
      expect(getUserInitials(user)).toBe("J");
    });

    it("should handle both names empty", () => {
      expect(getUserInitials(mockUserWithEmptyNames)).toBe("");
    });

    it("should convert to uppercase", () => {
      const user = { firstName: "john", lastName: "doe" };
      expect(getUserInitials(user)).toBe("JD");
    });

    it("should handle mixed case names", () => {
      const user = { firstName: "jOhN", lastName: "dOe" };
      expect(getUserInitials(user)).toBe("JD");
    });

    it("should handle names with spaces", () => {
      const user = { firstName: "John Michael", lastName: "Doe Smith" };
      expect(getUserInitials(user)).toBe("JD");
    });

    it("should handle single character names", () => {
      const user = { firstName: "J", lastName: "D" };
      expect(getUserInitials(user)).toBe("JD");
    });

    it("should handle names with special characters", () => {
      const user = { firstName: "José", lastName: "O'Connor" };
      expect(getUserInitials(user)).toBe("JO");
    });

    it("should handle names with numbers", () => {
      const user = { firstName: "John2", lastName: "Doe3" };
      expect(getUserInitials(user)).toBe("JD");
    });

    it("should handle null/undefined first character", () => {
      const user = { firstName: "", lastName: "Doe" };
      expect(getUserInitials(user)).toBe("D");

      const user2 = { firstName: "John", lastName: "" };
      expect(getUserInitials(user2)).toBe("J");
    });
  });

  describe("isVerified", () => {
    it("should return true when all verification fields are true", () => {
      expect(isVerified(mockVerifiedUser)).toBe(true);
    });

    it("should return false when any verification field is false", () => {
      expect(isVerified(mockUnverifiedUser)).toBe(false);
      expect(isVerified(mockPartiallyVerifiedUser)).toBe(false);
    });

    it("should return false when email is not verified", () => {
      const user = {
        emailVerified: false,
        idVerified: true,
        addressVerified: true,
      };
      expect(isVerified(user)).toBe(false);
    });

    it("should return false when ID is not verified", () => {
      const user = {
        emailVerified: true,
        idVerified: false,
        addressVerified: true,
      };
      expect(isVerified(user)).toBe(false);
    });

    it("should return false when address is not verified", () => {
      const user = {
        emailVerified: true,
        idVerified: true,
        addressVerified: false,
      };
      expect(isVerified(user)).toBe(false);
    });

    it("should handle undefined values", () => {
      const user = {
        emailVerified: undefined,
        idVerified: true,
        addressVerified: true,
      } as unknown as Pick<
        UserProfile,
        "emailVerified" | "idVerified" | "addressVerified"
      >;
      expect(isVerified(user)).toBe(false);
    });
  });

  describe("getUserStreet", () => {
    it("should return street when address is provided", () => {
      expect(getUserStreet(mockAddress)).toBe("123 Main St");
    });

    it("should return empty string when address is undefined", () => {
      expect(getUserStreet(undefined)).toBe("");
    });

    it("should return empty string when street is empty", () => {
      expect(getUserStreet(mockEmptyAddress)).toBe("");
    });

    it("should handle partial address", () => {
      expect(getUserStreet(mockPartialAddress)).toBe("123 Main St");
    });
  });

  describe("getUserCity", () => {
    it("should return city when address is provided", () => {
      expect(getUserCity(mockAddress)).toBe("Anytown");
    });

    it("should return empty string when address is undefined", () => {
      expect(getUserCity(undefined)).toBe("");
    });

    it("should return empty string when city is empty", () => {
      expect(getUserCity(mockEmptyAddress)).toBe("");
    });

    it("should handle partial address", () => {
      expect(getUserCity(mockPartialAddress)).toBe("Anytown");
    });
  });

  describe("getUserState", () => {
    it("should return state when address is provided", () => {
      expect(getUserState(mockAddress)).toBe("CA");
    });

    it("should return empty string when address is undefined", () => {
      expect(getUserState(undefined)).toBe("");
    });

    it("should return empty string when state is empty", () => {
      expect(getUserState(mockEmptyAddress)).toBe("");
    });

    it("should handle partial address", () => {
      expect(getUserState(mockPartialAddress)).toBe("");
    });
  });

  describe("getUserZip", () => {
    it("should return zip code when address is provided", () => {
      expect(getUserZip(mockAddress)).toBe("12345");
    });

    it("should return empty string when address is undefined", () => {
      expect(getUserZip(undefined)).toBe("");
    });

    it("should return empty string when zip code is empty", () => {
      expect(getUserZip(mockEmptyAddress)).toBe("");
    });

    it("should handle partial address", () => {
      expect(getUserZip(mockPartialAddress)).toBe("");
    });
  });

  describe("getFullAddress", () => {
    it("should return full address when all fields are provided", () => {
      expect(getFullAddress(mockAddress)).toBe(
        "123 Main St, Anytown, CA, 12345",
      );
    });

    it("should return empty string when address is undefined", () => {
      expect(getFullAddress(undefined)).toBe("");
    });

    it("should return empty string when all fields are empty", () => {
      expect(getFullAddress(mockEmptyAddress)).toBe("");
    });

    it("should filter out empty fields", () => {
      expect(getFullAddress(mockPartialAddress)).toBe("123 Main St, Anytown");
    });

    it("should handle only street", () => {
      const address = {
        street: "123 Main St",
        city: "",
        state: "",
        zipCode: "",
      } as UserProfile["primaryAddress"];
      expect(getFullAddress(address)).toBe("123 Main St");
    });

    it("should handle only city", () => {
      const address = {
        street: "",
        city: "Anytown",
        state: "",
        zipCode: "",
      } as UserProfile["primaryAddress"];
      expect(getFullAddress(address)).toBe("Anytown");
    });

    it("should handle only state", () => {
      const address = {
        street: "",
        city: "",
        state: "CA",
        zipCode: "",
      } as UserProfile["primaryAddress"];
      expect(getFullAddress(address)).toBe("CA");
    });

    it("should handle only zip code", () => {
      const address = {
        street: "",
        city: "",
        state: "",
        zipCode: "12345",
      } as UserProfile["primaryAddress"];
      expect(getFullAddress(address)).toBe("12345");
    });

    it("should handle street and zip only", () => {
      const address = {
        street: "123 Main St",
        city: "",
        state: "",
        zipCode: "12345",
      } as UserProfile["primaryAddress"];
      expect(getFullAddress(address)).toBe("123 Main St, 12345");
    });

    it("should handle city and state only", () => {
      const address = {
        street: "",
        city: "Anytown",
        state: "CA",
        zipCode: "",
      } as UserProfile["primaryAddress"];
      expect(getFullAddress(address)).toBe("Anytown, CA");
    });
  });

  describe("formatMemberSince", () => {
    it("should format valid date string correctly", () => {
      expect(formatMemberSince("2024-01-15")).toBe("Member since January 2024");
      expect(formatMemberSince("2023-12-01T12:00:00Z")).toBe(
        "Member since December 2023",
      );
      expect(formatMemberSince("2022-06-15")).toBe("Member since June 2022");
    });

    it("should format valid Date object correctly", () => {
      const date = new Date("2024-01-15");
      expect(formatMemberSince(date)).toBe("Member since January 2024");
    });

    it("should handle different months correctly", () => {
      expect(formatMemberSince("2024-02-15")).toBe(
        "Member since February 2024",
      );
      expect(formatMemberSince("2024-03-15")).toBe("Member since March 2024");
      expect(formatMemberSince("2024-04-15")).toBe("Member since April 2024");
      expect(formatMemberSince("2024-05-15")).toBe("Member since May 2024");
      expect(formatMemberSince("2024-06-15")).toBe("Member since June 2024");
      expect(formatMemberSince("2024-07-15")).toBe("Member since July 2024");
      expect(formatMemberSince("2024-08-15")).toBe("Member since August 2024");
      expect(formatMemberSince("2024-09-15")).toBe(
        "Member since September 2024",
      );
      expect(formatMemberSince("2024-10-15")).toBe("Member since October 2024");
      expect(formatMemberSince("2024-11-15")).toBe(
        "Member since November 2024",
      );
      expect(formatMemberSince("2024-12-15")).toBe(
        "Member since December 2024",
      );
    });

    it("should handle different years correctly", () => {
      expect(formatMemberSince("2020-01-15")).toBe("Member since January 2020");
      expect(formatMemberSince("2025-01-15")).toBe("Member since January 2025");
      expect(formatMemberSince("1999-01-15")).toBe("Member since January 1999");
    });

    it("should handle leap year dates", () => {
      expect(formatMemberSince("2024-02-29")).toBe(
        "Member since February 2024",
      );
    });

    it("should return 'Member since Unknown' for invalid date strings", () => {
      expect(formatMemberSince("invalid-date")).toBe("Member since Unknown");
      expect(formatMemberSince("not-a-date")).toBe("Member since Unknown");
      expect(formatMemberSince("")).toBe("Member since Unknown");
    });

    it("should return 'Member since Unknown' for invalid Date objects", () => {
      const invalidDate = new Date("invalid-date");
      expect(formatMemberSince(invalidDate)).toBe("Member since Unknown");
    });

    it("should handle ISO date strings", () => {
      expect(formatMemberSince("2024-01-15T10:30:00Z")).toBe(
        "Member since January 2024",
      );
      expect(formatMemberSince("2024-01-15T10:30:00.000Z")).toBe(
        "Member since January 2024",
      );
    });

    it("should handle different date formats", () => {
      expect(formatMemberSince("01/15/2024")).toBe("Member since January 2024");
      // Note: "15/01/2024" is not a valid US date format, so it should return "Unknown"
      expect(formatMemberSince("15/01/2024")).toBe("Member since Unknown");
    });

    it("should handle edge case dates", () => {
      // Use explicit UTC dates to avoid timezone issues
      expect(formatMemberSince("2024-01-01T12:00:00Z")).toBe(
        "Member since January 2024",
      );
      expect(formatMemberSince("2024-12-31T12:00:00Z")).toBe(
        "Member since December 2024",
      );
    });

    it("should handle very old dates", () => {
      // Use explicit UTC dates to avoid timezone issues
      expect(formatMemberSince("1900-01-01T12:00:00Z")).toBe(
        "Member since January 1900",
      );
      expect(formatMemberSince("1970-01-01T12:00:00Z")).toBe(
        "Member since January 1970",
      );
    });

    it("should handle future dates", () => {
      // Use a specific date that should work consistently across timezones
      const futureDate = new Date("2030-06-15T12:00:00Z");
      expect(formatMemberSince(futureDate)).toBe("Member since June 2030");
      expect(formatMemberSince("2030-12-31")).toBe(
        "Member since December 2030",
      );
    });

    it("should handle null and undefined gracefully", () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(formatMemberSince(null)).toBe("Member since Unknown");
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(formatMemberSince(undefined)).toBe("Member since Unknown");
    });

    it("should handle non-string, non-Date inputs", () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(formatMemberSince(123)).toBe("Member since Unknown");
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(formatMemberSince({})).toBe("Member since Unknown");
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(formatMemberSince(true)).toBe("Member since Unknown");
    });
  });
});
