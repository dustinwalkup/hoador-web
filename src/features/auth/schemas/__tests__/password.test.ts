import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  emailSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
} from "../password";

describe("password.ts", () => {
  describe("passwordSchema", () => {
    it("should accept valid passwords with uppercase, lowercase, and number", () => {
      const validPasswords = [
        "Password123",
        "SecurePass1",
        "MyP@ssw0rd",
        "Complex123Password",
      ];

      validPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it("should reject passwords shorter than 8 characters", () => {
      const shortPasswords = ["Pass1", "P1", "Short", ""];

      shortPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it("should accept passwords at minimum length (8 characters)", () => {
      const result = passwordSchema.safeParse("Pass1234");
      expect(result.success).toBe(true);
    });

    it("should reject passwords without uppercase letter", () => {
      const result = passwordSchema.safeParse("password123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes("uppercase"),
          ),
        ).toBe(true);
      }
    });

    it("should reject passwords without lowercase letter", () => {
      const result = passwordSchema.safeParse("PASSWORD123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes("lowercase"),
          ),
        ).toBe(true);
      }
    });

    it("should reject passwords without number", () => {
      const result = passwordSchema.safeParse("Password");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message.includes("number")),
        ).toBe(true);
      }
    });

    it("should accept passwords with special characters", () => {
      const passwordsWithSpecial = [
        "Pass@123",
        "Pass#123",
        "Pass$123",
        "Pass!123",
      ];

      passwordsWithSpecial.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("emailSchema", () => {
    it("should accept valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@example.co.uk",
        "user+tag@example.com",
        "user123@test-domain.com",
      ];

      validEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "invalid-email",
        "@example.com",
        "test@",
        "test..test@example.com",
        "",
        "test@example",
      ];

      invalidEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("resetPasswordSchema", () => {
    it("should accept valid reset password data", () => {
      const validData = {
        token: "reset-token-123",
        password: "NewSecurePass123",
      };

      const result = resetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject reset password data with empty token", () => {
      const invalidData = {
        token: "",
        password: "NewSecurePass123",
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject reset password data with weak password", () => {
      const invalidData = {
        token: "reset-token-123",
        password: "weak",
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject reset password data with missing token", () => {
      const invalidData = {
        password: "NewSecurePass123",
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject reset password data with missing password", () => {
      const invalidData = {
        token: "reset-token-123",
      };

      const result = resetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("should accept valid forgot password data", () => {
      const validData = {
        email: "test@example.com",
      };

      const result = forgotPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject forgot password data with invalid email", () => {
      const invalidData = {
        email: "invalid-email",
      };

      const result = forgotPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject forgot password data with empty email", () => {
      const invalidData = {
        email: "",
      };

      const result = forgotPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject forgot password data with missing email", () => {
      const result = forgotPasswordSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
