import { describe, it, expect } from "vitest";
import { capitalize, formatPhoneNumber } from "..";

describe("utils", () => {
  describe("capitalize", () => {
    it("should capitalize the first letter and lowercase the rest", () => {
      expect(capitalize("hello")).toBe("Hello");
      expect(capitalize("WORLD")).toBe("World");
      expect(capitalize("tEsT")).toBe("Test");
    });

    it("should handle single character strings", () => {
      expect(capitalize("a")).toBe("A");
      expect(capitalize("Z")).toBe("Z");
    });

    it("should handle empty string", () => {
      expect(capitalize("")).toBe("");
    });

    it("should handle strings with only spaces", () => {
      expect(capitalize("   ")).toBe("   ");
    });

    it("should handle strings with numbers", () => {
      expect(capitalize("123")).toBe("123");
      expect(capitalize("test123")).toBe("Test123");
      expect(capitalize("123test")).toBe("123test");
    });

    it("should handle strings with special characters", () => {
      expect(capitalize("hello-world")).toBe("Hello-world");
      expect(capitalize("hello_world")).toBe("Hello_world");
      expect(capitalize("hello.world")).toBe("Hello.world");
    });

    it("should handle strings with unicode characters", () => {
      expect(capitalize("café")).toBe("Café");
      expect(capitalize("naïve")).toBe("Naïve");
      expect(capitalize("résumé")).toBe("Résumé");
    });

    it("should handle already capitalized strings", () => {
      expect(capitalize("Hello")).toBe("Hello");
      expect(capitalize("HELLO")).toBe("Hello");
    });

    it("should handle mixed case strings", () => {
      expect(capitalize("hELLo WoRLd")).toBe("Hello world");
      expect(capitalize("MiXeD cAsE")).toBe("Mixed case");
    });

    it("should handle strings with leading/trailing spaces", () => {
      expect(capitalize(" hello ")).toBe(" hello ");
      expect(capitalize("  test  ")).toBe("  test  ");
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(1000);
      const expected = "A" + "a".repeat(999);
      expect(capitalize(longString)).toBe(expected);
    });

    it("should handle strings with only special characters", () => {
      expect(capitalize("!@#$%")).toBe("!@#$%");
      expect(capitalize("...")).toBe("...");
    });

    it("should handle null and undefined gracefully", () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(capitalize(null)).toBe("");
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(capitalize(undefined)).toBe("");
    });

    it("should handle capitalize with non-string inputs", () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(() => capitalize(123)).toThrow();
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(() => capitalize(true)).toThrow();
      // @ts-expect-error - Testing runtime behavior with invalid input
      expect(() => capitalize({})).toThrow();
    });
  });

  describe("formatPhoneNumber", () => {
    it("should return digits as-is for less than 4 digits", () => {
      expect(formatPhoneNumber("123")).toBe("123");
      expect(formatPhoneNumber("1")).toBe("1");
      expect(formatPhoneNumber("")).toBe("");
    });

    it("should format 4-6 digits as (XXX) XXX", () => {
      expect(formatPhoneNumber("1234")).toBe("(123) 4");
      expect(formatPhoneNumber("123456")).toBe("(123) 456");
    });

    it("should format 7+ digits as (XXX) XXX-XXXX", () => {
      expect(formatPhoneNumber("1234567")).toBe("(123) 456-7");
      expect(formatPhoneNumber("1234567890")).toBe("(123) 456-7890");
    });

    it("should strip non-digit characters before formatting", () => {
      expect(formatPhoneNumber("(123) 456-7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("123-456-7890")).toBe("(123) 456-7890");
      expect(formatPhoneNumber("123.456.7890")).toBe("(123) 456-7890");
    });

    it("should truncate to 10 digits", () => {
      expect(formatPhoneNumber("12345678901234")).toBe("(123) 456-7890");
    });
  });
});
