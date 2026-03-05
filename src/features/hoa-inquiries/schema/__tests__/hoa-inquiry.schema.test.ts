import { describe, it, expect } from "vitest";
import { hoaInquirySchema } from "../hoa-inquiry.schema";

const validData = {
  hoaName: "Sunset Ridge HOA",
  city: "Austin",
  state: "TX",
  name: "John Doe",
  email: "john@example.com",
  phone: "5551234567",
  hoaContactName: "Jane Smith",
  hoaContactEmail: "jane@hoa.com",
  hoaContactPhone: "5559876543",
};

describe("hoaInquirySchema", () => {
  it("should accept valid data with all fields", () => {
    const result = hoaInquirySchema.safeParse(validData);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  it("should accept valid data with only required fields", () => {
    const result = hoaInquirySchema.safeParse({
      hoaName: "Test HOA",
      city: "Denver",
      state: "CO",
      name: "Test User",
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty optional fields", () => {
    const result = hoaInquirySchema.safeParse({
      ...validData,
      phone: "",
      hoaContactName: "",
      hoaContactEmail: "",
      hoaContactPhone: "",
    });
    expect(result.success).toBe(true);
  });

  describe("required fields", () => {
    const requiredFields = ["hoaName", "city", "state", "name", "email"];

    requiredFields.forEach((field) => {
      it(`should reject empty ${field}`, () => {
        const result = hoaInquirySchema.safeParse({
          ...validData,
          [field]: "",
        });
        expect(result.success).toBe(false);
      });
    });

    it("should reject missing required fields entirely", () => {
      const result = hoaInquirySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("email validation", () => {
    it("should reject invalid email format", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid email", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        email: "valid@test.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("state validation", () => {
    it("should accept valid US state abbreviation", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        state: "CA",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid state abbreviation", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        state: "XX",
      });
      expect(result.success).toBe(false);
    });

    it("should reject full state name", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        state: "Texas",
      });
      expect(result.success).toBe(false);
    });

    it("should accept DC", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        state: "DC",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("hoaContactEmail validation", () => {
    it("should accept valid hoaContactEmail when provided", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        hoaContactEmail: "contact@hoa.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid hoaContactEmail when provided", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        hoaContactEmail: "not-valid",
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty hoaContactEmail", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        hoaContactEmail: "",
      });
      expect(result.success).toBe(true);
    });

    it("should accept undefined hoaContactEmail", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hoaContactEmail, ...rest } = validData;
      const result = hoaInquirySchema.safeParse(rest);
      expect(result.success).toBe(true);
    });
  });

  describe("max length validation", () => {
    it("should reject hoaName exceeding 255 characters", () => {
      const result = hoaInquirySchema.safeParse({
        ...validData,
        hoaName: "a".repeat(256),
      });
      expect(result.success).toBe(false);
    });
  });
});
