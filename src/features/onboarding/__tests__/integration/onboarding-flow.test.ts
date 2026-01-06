import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboardingAction } from "../../actions/onboarding-action";
import { userDAL } from "@/dal";
import {
  mockOnboardingData,
  mockUserForOnboarding,
  mockUserAfterOnboarding,
} from "@/test/fixtures/onboarding";

// Mock dependencies
vi.mock("@/dal", () => ({
  userDAL: {
    updateUser: vi.fn(),
    updateUserPrimaryAddress: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { getCurrentUser } from "@/features/auth/utils/session";
import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";

describe("Onboarding Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full flow: Form → Action → DAL → Database", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("bio", mockOnboardingData.bio || "");
    formData.append(
      "profileImageUrl",
      mockOnboardingData.profileImageUrl || "",
    );
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    const mockUpdatedUser = {
      ...mockUserAfterOnboarding,
      status: "active",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({
        data: mockUpdatedUser,
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any);

    // Act
    try {
      await onboardingAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Verify complete flow execution
    expect(getCurrentUser).toHaveBeenCalled();
    expect(tryCatch).toHaveBeenCalledTimes(2); // User update + address update
    expect(userDAL.updateUser).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      expect.objectContaining({
        firstName: mockOnboardingData.firstName,
        lastName: mockOnboardingData.lastName,
        phone: mockOnboardingData.phone,
        bio: mockOnboardingData.bio,
        profileImageUrl: mockOnboardingData.profileImageUrl,
        status: "active",
      }),
    );
    expect(userDAL.updateUserPrimaryAddress).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      mockOnboardingData.address,
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should propagate validation errors from action to form", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", ""); // Invalid: empty
    formData.append("lastName", "");
    formData.append("phone", "123"); // Invalid: too short
    formData.append("street", "");
    formData.append("city", "");
    formData.append("state", "");
    formData.append("zipCode", "");
    formData.append("agreeToTerms", "false");

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toBe("Please check your information and try again.");
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should propagate error from DAL to action to form", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    } as any);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert - Error propagated from DAL through action
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Failed to update your profile. Please try again.",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should handle address update: optional but handled", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    const mockUpdatedUser = {
      ...mockUserAfterOnboarding,
      status: "active",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({
        data: mockUpdatedUser,
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any);

    // Act
    try {
      await onboardingAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Address update is called and succeeds
    expect(userDAL.updateUserPrimaryAddress).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      mockOnboardingData.address,
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should complete onboarding even when address update fails (non-critical)", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    const mockUpdatedUser = {
      ...mockUserAfterOnboarding,
      status: "active",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({
        data: mockUpdatedUser,
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Address update failed" },
      } as any);

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Act
    try {
      await onboardingAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Profile update succeeds, address update fails but onboarding completes
    expect(userDAL.updateUser).toHaveBeenCalled();
    expect(userDAL.updateUserPrimaryAddress).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
    consoleWarnSpy.mockRestore();
  });

  it("should validate data before calling DAL methods", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", ""); // Invalid
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert - Validation happens before DAL calls
    expect(result.success).toBe(false);
    expect(tryCatch).not.toHaveBeenCalled();
    expect(userDAL.updateUser).not.toHaveBeenCalled();
  });
});
