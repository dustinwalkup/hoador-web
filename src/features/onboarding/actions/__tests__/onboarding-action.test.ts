import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboardingAction } from "../onboarding-action";
import { userDAL } from "@/dal";
import {
  mockOnboardingData,
  mockOnboardingDataMinimal,
  mockUserForOnboarding,
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

describe("onboardingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete onboarding with valid FormData and redirect", async () => {
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
      ...mockUserForOnboarding,
      ...mockOnboardingData,
      status: "active",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch).mockResolvedValue({
      data: mockUpdatedUser,
      error: null,
    } as any);

    // Act
    try {
      await onboardingAction(null, formData);
    } catch (error) {
      // redirect() throws, but we mocked it so it won't throw
      // If it does throw, that's expected for Next.js redirects
    }

    // Assert
    expect(getCurrentUser).toHaveBeenCalled();
    expect(tryCatch).toHaveBeenCalled();
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

  it("should return error when user not authenticated", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);

    vi.mocked(getCurrentUser).mockResolvedValue(null);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "User not found. Please log in and try again.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when FormData is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", ""); // Invalid: empty
    formData.append("lastName", ""); // Invalid: empty
    formData.append("phone", "123"); // Invalid: too short

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Please check your information and try again.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when required fields are missing", async () => {
    // Arrange
    const formData = new FormData();
    // Missing firstName, lastName, phone, address, agreeToTerms

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Please check your information and try again.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when phone format is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", "123"); // Invalid: too short
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Please check your information and try again.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when address is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", ""); // Invalid: empty
    formData.append("city", ""); // Invalid: empty
    formData.append("state", "XX"); // Invalid: not valid state code
    formData.append("zipCode", "123"); // Invalid: too short
    formData.append("agreeToTerms", "true");

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Please check your information and try again.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when terms not agreed", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "false"); // Not agreed

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Please check your information and try again.",
    });
    expect(tryCatch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when user profile update fails", async () => {
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
      error: { message: "Database error" },
    } as any);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to update your profile. Please try again.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return error when user profile update returns null", async () => {
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
      error: null,
    } as any);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Failed to update user profile. Please try again.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return specific error when user update is unauthorized", async () => {
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
      error: { message: "Unauthorized access" },
    } as any);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "You don't have permission to update this profile.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return specific error when user not found", async () => {
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
      error: { message: "User not found" },
    } as any);

    // Act
    const result = await onboardingAction(null, formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "User account not found.",
    });
    expect(redirect).not.toHaveBeenCalled();
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
      ...mockUserForOnboarding,
      ...mockOnboardingData,
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
    } catch (error) {
      // redirect() throws
    }

    // Assert
    expect(userDAL.updateUser).toHaveBeenCalled();
    expect(userDAL.updateUserPrimaryAddress).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Address update failed during onboarding:",
      expect.any(Object),
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
    consoleWarnSpy.mockRestore();
  });

  it("should handle minimal required fields only", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingDataMinimal.firstName);
    formData.append("lastName", mockOnboardingDataMinimal.lastName);
    formData.append("phone", mockOnboardingDataMinimal.phone);
    formData.append("bio", "");
    formData.append("profileImageUrl", "");
    formData.append("street", mockOnboardingDataMinimal.address.street);
    formData.append("city", mockOnboardingDataMinimal.address.city);
    formData.append("state", mockOnboardingDataMinimal.address.state);
    formData.append("zipCode", mockOnboardingDataMinimal.address.zipCode);
    formData.append("agreeToTerms", "true");

    const mockUpdatedUser = {
      ...mockUserForOnboarding,
      ...mockOnboardingDataMinimal,
      status: "active",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch).mockResolvedValue({
      data: mockUpdatedUser,
      error: null,
    } as any);

    // Act
    try {
      await onboardingAction(null, formData);
    } catch (error) {
      // redirect() throws
    }

    // Assert
    expect(userDAL.updateUser).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      expect.objectContaining({
        firstName: mockOnboardingDataMinimal.firstName,
        lastName: mockOnboardingDataMinimal.lastName,
        phone: mockOnboardingDataMinimal.phone,
        status: "active",
      }),
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should handle agreeToTerms as 'on' string", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("firstName", mockOnboardingData.firstName);
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", mockOnboardingData.phone);
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "on"); // Checkbox format

    const mockUpdatedUser = {
      ...mockUserForOnboarding,
      ...mockOnboardingData,
      status: "active",
    };

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);
    vi.mocked(tryCatch).mockResolvedValue({
      data: mockUpdatedUser,
      error: null,
    } as any);

    // Act
    try {
      await onboardingAction(null, formData);
    } catch (error) {
      // redirect() throws
    }

    // Assert
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
