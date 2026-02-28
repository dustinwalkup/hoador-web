import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  signOut,
  signInEmail,
  signInSocial,
  getSafeCallbackUrl,
} from "../index";

// Mock Better Auth client
vi.mock("@/services/better-auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
  },
}));

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    href: "",
  },
  writable: true,
});

import { authClient } from "@/services/better-auth/client";

describe("index.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.location.href = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("signOut", () => {
    it("should sign out user successfully", async () => {
      // Arrange
      vi.mocked(authClient.signOut).mockResolvedValue(undefined);

      // Act
      const signOutPromise = signOut();
      await vi.runAllTimersAsync();
      await signOutPromise;

      // Assert
      expect(authClient.signOut).toHaveBeenCalled();
    });

    it("should redirect to specified URL after sign out", async () => {
      // Arrange
      const redirectTo = "/login";
      vi.mocked(authClient.signOut).mockResolvedValue(undefined);

      // Act
      const signOutPromise = signOut(redirectTo);
      await vi.runAllTimersAsync();
      await signOutPromise;

      // Assert
      expect(authClient.signOut).toHaveBeenCalled();
      expect(window.location.href).toBe(redirectTo);
    });

    it("should not redirect when no redirectTo provided", async () => {
      // Arrange
      vi.mocked(authClient.signOut).mockResolvedValue(undefined);

      // Act
      const signOutPromise = signOut();
      await vi.runAllTimersAsync();
      await signOutPromise;

      // Assert
      expect(authClient.signOut).toHaveBeenCalled();
      expect(window.location.href).toBe("");
    });
  });

  describe("signInEmail", () => {
    it("should sign in user with email successfully", async () => {
      // Arrange
      const email = "test@example.com";
      const password = "password123";
      vi.mocked(authClient.signIn.email).mockResolvedValue({
        error: null,
      } as any);

      // Act
      await signInEmail(email, password);

      // Assert
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email,
        password,
        callbackURL: undefined,
      });
    });

    it("should sign in with callback URL", async () => {
      // Arrange
      const email = "test@example.com";
      const password = "password123";
      const callbackUrl = "/dashboard";
      vi.mocked(authClient.signIn.email).mockResolvedValue({
        error: null,
      } as any);

      // Act
      await signInEmail(email, password, callbackUrl);

      // Assert
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email,
        password,
        callbackURL: callbackUrl,
      });
    });

    it("should throw error when sign in fails", async () => {
      // Arrange
      const email = "test@example.com";
      const password = "wrongpassword";
      const mockError = {
        message: "Invalid credentials",
      };
      vi.mocked(authClient.signIn.email).mockResolvedValue({
        error: mockError,
      } as any);

      // Act & Assert
      await expect(signInEmail(email, password)).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("should throw generic error when error message is missing", async () => {
      // Arrange
      const email = "test@example.com";
      const password = "password123";
      vi.mocked(authClient.signIn.email).mockResolvedValue({
        error: {},
      } as any);

      // Act & Assert
      await expect(signInEmail(email, password)).rejects.toThrow(
        "Invalid email or password",
      );
    });
  });

  describe("signInSocial", () => {
    it("should sign in user with social provider successfully", async () => {
      // Arrange
      const provider = "google";
      vi.mocked(authClient.signIn.social).mockResolvedValue({
        error: null,
      } as any);

      // Act
      await signInSocial(provider);

      // Assert
      expect(authClient.signIn.social).toHaveBeenCalledWith({
        provider,
        callbackURL: undefined,
      });
    });

    it("should sign in with callback URL", async () => {
      // Arrange
      const provider = "google";
      const callbackUrl = "/dashboard";
      vi.mocked(authClient.signIn.social).mockResolvedValue({
        error: null,
      } as any);

      // Act
      await signInSocial(provider, callbackUrl);

      // Assert
      expect(authClient.signIn.social).toHaveBeenCalledWith({
        provider,
        callbackURL: callbackUrl,
      });
    });

    it("should throw error when sign in fails", async () => {
      // Arrange
      const provider = "google";
      const mockError = {
        message: "Authentication failed",
      };
      vi.mocked(authClient.signIn.social).mockResolvedValue({
        error: mockError,
      } as any);

      // Act & Assert
      await expect(signInSocial(provider)).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should throw generic error when error message is missing", async () => {
      // Arrange
      const provider = "google";
      vi.mocked(authClient.signIn.social).mockResolvedValue({
        error: {},
      } as any);

      // Act & Assert
      await expect(signInSocial(provider)).rejects.toThrow(
        "Failed to sign in with social provider",
      );
    });
  });

  describe("getSafeCallbackUrl", () => {
    it("returns /dashboard for null or empty", () => {
      expect(getSafeCallbackUrl(null)).toBe("/dashboard");
      expect(getSafeCallbackUrl("")).toBe("/dashboard");
      expect(getSafeCallbackUrl("   ")).toBe("/dashboard");
    });

    it("returns path for valid relative paths", () => {
      expect(getSafeCallbackUrl("/dashboard")).toBe("/dashboard");
      expect(getSafeCallbackUrl("/join-code")).toBe("/join-code");
      expect(getSafeCallbackUrl("/dashboard/garage")).toBe("/dashboard/garage");
    });

    it("returns path for relative path with safe query string", () => {
      expect(getSafeCallbackUrl("/dashboard?tab=settings")).toBe(
        "/dashboard?tab=settings",
      );
    });

    it("returns /dashboard for absolute URLs to prevent open redirect", () => {
      expect(getSafeCallbackUrl("https://evil.com")).toBe("/dashboard");
      expect(getSafeCallbackUrl("http://evil.com")).toBe("/dashboard");
      expect(getSafeCallbackUrl("//evil.com")).toBe("/dashboard");
    });

    it("returns /dashboard for javascript or other schemes", () => {
      expect(getSafeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
      expect(getSafeCallbackUrl("data:text/html,<script>")).toBe("/dashboard");
    });

    it("returns /dashboard for path that contains colon to avoid protocol-relative", () => {
      expect(getSafeCallbackUrl("/path?url=https://evil.com")).toBe(
        "/dashboard",
      );
    });
  });
});
