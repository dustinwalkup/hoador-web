import { describe, it, expect } from "vitest";
import {
  onboardingSchema,
  addressSchema,
  phoneSchema,
  validateField,
  validateFields,
  type OnboardingData,
} from "../validation";
import {
  mockOnboardingData,
  mockOnboardingDataMinimal,
  mockAddressData,
} from "@/test/fixtures/onboarding";

describe("onboardingSchema", () => {
  describe("Valid data", () => {
    it("should accept complete valid onboarding data", () => {
      const result = onboardingSchema.safeParse(mockOnboardingData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockOnboardingData);
      }
    });

    it("should accept minimal required fields only", () => {
      const result = onboardingSchema.safeParse(mockOnboardingDataMinimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe(mockOnboardingDataMinimal.firstName);
        expect(result.data.lastName).toBe(mockOnboardingDataMinimal.lastName);
        expect(result.data.phone).toBe(mockOnboardingDataMinimal.phone);
        expect(result.data.address).toEqual(mockOnboardingDataMinimal.address);
      }
    });

    it("should accept optional bio and profileImageUrl", () => {
      const data: OnboardingData = {
        ...mockOnboardingDataMinimal,
        bio: "A short bio",
        profileImageUrl: "https://example.com/image.jpg",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBe("A short bio");
        expect(result.data.profileImageUrl).toBe(
          "https://example.com/image.jpg",
        );
      }
    });

    it("should accept empty string for optional bio", () => {
      const data: OnboardingData = {
        ...mockOnboardingDataMinimal,
        bio: "",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBe("");
      }
    });

    it("should accept empty string for optional profileImageUrl", () => {
      const data: OnboardingData = {
        ...mockOnboardingDataMinimal,
        profileImageUrl: "",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.profileImageUrl).toBe("");
      }
    });
  });

  describe("Invalid data", () => {
    it("should reject missing firstName", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        firstName: "",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("First name is required");
      }
    });

    it("should reject missing lastName", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        lastName: "",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Last name is required");
      }
    });

    it("should reject missing phone", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        phone: "",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Phone number is required");
      }
    });

    it("should reject invalid phone format", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        phone: "123", // Too short
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const phoneError = result.error.issues.find((issue) =>
          issue.path.includes("phone"),
        );
        expect(phoneError).toBeDefined();
      }
    });

    it("should reject missing address fields", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        address: {
          street: "",
          city: "",
          state: "",
          zipCode: "",
        },
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject invalid state code (not 2 letters)", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        address: {
          ...mockOnboardingDataMinimal.address,
          state: "X", // Too short
        },
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const stateError = result.error.issues.find((issue) =>
          issue.path.includes("state"),
        );
        expect(stateError).toBeDefined();
      }
    });

    it("should reject invalid ZIP code format", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        address: {
          ...mockOnboardingDataMinimal.address,
          zipCode: "123", // Too short
        },
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const zipError = result.error.issues.find((issue) =>
          issue.path.includes("zipCode"),
        );
        expect(zipError).toBeDefined();
      }
    });

    it("should reject bio over 200 characters", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        bio: "A".repeat(201),
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const bioError = result.error.issues.find((issue) =>
          issue.path.includes("bio"),
        );
        expect(bioError?.message).toBe("Bio must be 200 characters or less");
      }
    });

    it("should reject invalid profileImageUrl (not a URL)", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        profileImageUrl: "not-a-url",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const urlError = result.error.issues.find((issue) =>
          issue.path.includes("profileImageUrl"),
        );
        expect(urlError?.message).toBe("Invalid image URL");
      }
    });
  });

  describe("Phone number transformation", () => {
    it("should strip non-digits from phone number", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        phone: "(555) 123-4567",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        // Phone is transformed to digits only internally
        expect(result.data.phone).toBe("5551234567");
      }
    });

    it("should handle phone with spaces", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        phone: "555 123 4567",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("5551234567");
      }
    });

    it("should handle phone with dashes", () => {
      const data = {
        ...mockOnboardingDataMinimal,
        phone: "555-123-4567",
      };
      const result = onboardingSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("5551234567");
      }
    });
  });
});

describe("addressSchema", () => {
  describe("Valid data", () => {
    it("should accept complete address", () => {
      const result = addressSchema.safeParse(mockAddressData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAddressData);
      }
    });

    it("should transform state code to uppercase", () => {
      const data = {
        ...mockAddressData,
        state: "ca", // Lowercase
      };
      const result = addressSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe("CA");
      }
    });
  });

  describe("Invalid data", () => {
    it("should reject missing street", () => {
      const data = {
        ...mockAddressData,
        street: "",
      };
      const result = addressSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Street address is required",
        );
      }
    });

    it("should reject missing city", () => {
      const data = {
        ...mockAddressData,
        city: "",
      };
      const result = addressSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("City is required");
      }
    });

    it("should reject invalid state (not 2 letters)", () => {
      const data = {
        ...mockAddressData,
        state: "X", // Too short
      };
      const result = addressSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const stateError = result.error.issues.find((issue) =>
          issue.path.includes("state"),
        );
        expect(stateError).toBeDefined();
      }
    });

    it("should reject invalid ZIP format", () => {
      const data = {
        ...mockAddressData,
        zipCode: "12", // Too short
      };
      const result = addressSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const zipError = result.error.issues.find((issue) =>
          issue.path.includes("zipCode"),
        );
        expect(zipError).toBeDefined();
      }
    });

    it("should accept ZIP+4 format", () => {
      const data = {
        ...mockAddressData,
        zipCode: "94102-1234",
      };
      const result = addressSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.zipCode).toBe("94102-1234");
      }
    });
  });
});

describe("phoneSchema", () => {
  describe("Valid data", () => {
    it("should accept various phone formats and transform correctly", () => {
      const formats = [
        "(555) 123-4567",
        "555-123-4567",
        "555 123 4567",
        "5551234567",
        "+1 555 123 4567",
      ];

      formats.forEach((phone) => {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(true);
        if (result.success) {
          // All should transform to digits only
          expect(result.data).toMatch(/^\d+$/);
          expect(result.data.length).toBeGreaterThanOrEqual(10);
        }
      });
    });

    it("should accept phone with country code", () => {
      const result = phoneSchema.safeParse("+1 555 123 4567");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatch(/^\d+$/);
        expect(result.data.length).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe("Invalid data", () => {
    it("should reject phone with less than 10 digits", () => {
      const result = phoneSchema.safeParse("123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Phone number must be at least 10 digits",
        );
      }
    });

    it("should reject phone with invalid characters", () => {
      const result = phoneSchema.safeParse("555-abc-1234");
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should fail regex validation
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("validateField", () => {
  describe("Valid field values", () => {
    it("should return null for valid firstName", () => {
      const result = validateField("firstName", "John");
      expect(result).toBeNull();
    });

    it("should return null for valid lastName", () => {
      const result = validateField("lastName", "Doe");
      expect(result).toBeNull();
    });

    it("should return null for valid phone", () => {
      const result = validateField("phone", "5551234567");
      expect(result).toBeNull();
    });

    it("should return null for valid bio", () => {
      const result = validateField("bio", "A short bio");
      expect(result).toBeNull();
    });

    it("should return null for valid profileImageUrl", () => {
      const result = validateField(
        "profileImageUrl",
        "https://example.com/image.jpg",
      );
      expect(result).toBeNull();
    });

    it("should return null for valid nested address fields", () => {
      expect(validateField("address.street", "123 Main St")).toBeNull();
      expect(validateField("address.city", "San Francisco")).toBeNull();
      expect(validateField("address.state", "CA")).toBeNull();
      expect(validateField("address.zipCode", "94102")).toBeNull();
    });
  });

  describe("Invalid field values", () => {
    it("should return error message for invalid firstName", () => {
      const result = validateField("firstName", "");
      expect(result).toBe("First name is required");
    });

    it("should return error message for invalid lastName", () => {
      const result = validateField("lastName", "");
      expect(result).toBe("Last name is required");
    });

    it("should return error message for invalid phone", () => {
      const result = validateField("phone", "123");
      expect(result).toBeTruthy();
      expect(result).toContain("Phone");
    });

    it("should return error message for invalid bio (too long)", () => {
      const result = validateField("bio", "A".repeat(201));
      expect(result).toBe("Bio must be 200 characters or less");
    });

    it("should return error message for invalid profileImageUrl", () => {
      const result = validateField("profileImageUrl", "not-a-url");
      expect(result).toBe("Invalid image URL");
    });

    it("should return error message for invalid nested address fields", () => {
      expect(validateField("address.street", "")).toBe(
        "Street address is required",
      );
      expect(validateField("address.city", "")).toBe("City is required");
      expect(validateField("address.state", "X")).toBeTruthy();
      expect(validateField("address.zipCode", "12")).toBeTruthy();
    });
  });
});

describe("validateFields", () => {
  describe("Valid data", () => {
    it("should return empty object for valid data", () => {
      const result = validateFields(mockOnboardingData);
      expect(result).toEqual({});
    });

    it("should return empty object for minimal valid data", () => {
      const result = validateFields(mockOnboardingDataMinimal);
      expect(result).toEqual({});
    });
  });

  describe("Invalid data", () => {
    it("should return error map with field paths for invalid data", () => {
      const invalidData = {
        firstName: "",
        lastName: "",
        phone: "123",
        address: {
          street: "",
          city: "",
          state: "X",
          zipCode: "12",
        },
      };

      const result = validateFields(invalidData as any);
      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
      expect(result.firstName).toBeDefined();
      expect(result.lastName).toBeDefined();
      expect(result.phone).toBeDefined();
      expect(result["address.street"]).toBeDefined();
      expect(result["address.city"]).toBeDefined();
      expect(result["address.state"]).toBeDefined();
      expect(result["address.zipCode"]).toBeDefined();
    });

    it("should include all validation errors", () => {
      const invalidData = {
        ...mockOnboardingDataMinimal,
        firstName: "",
        phone: "123",
        address: {
          ...mockOnboardingDataMinimal.address,
          street: "",
        },
      };

      const result = validateFields(invalidData as any);
      expect(result.firstName).toBe("First name is required");
      expect(result["address.street"]).toBe("Street address is required");
      expect(result.phone).toBeTruthy();
    });
  });
});
