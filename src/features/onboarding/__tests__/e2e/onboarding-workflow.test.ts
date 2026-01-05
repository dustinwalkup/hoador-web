import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboardingAction } from "../../actions/onboarding-action";
import { userDAL } from "@/dal";
import {
  mockOnboardingData,
  mockOnboardingDataMinimal,
  mockUserForOnboarding,
  mockUserAfterOnboarding,
} from "@/test/fixtures/onboarding";

// Mock all dependencies for E2E test
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

describe("Complete Onboarding Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full onboarding workflow", async () => {
    // Step 1: New user signs up (mocked - user exists in onboarding state)
    // Step 2: User redirected to onboarding (simulated by having user in onboarding state)
    // Step 3: User fills out onboarding form
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

    // Step 4: User uploads profile image (simulated by profileImageUrl in formData)
    // Step 5: User submits form
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

    // Step 6: Verify onboarding completed
    try {
      await onboardingAction(null, formData);
    } catch (error) {
      // redirect() throws
    }

    // Step 7: Verify user status is "active"
    expect(userDAL.updateUser).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      expect.objectContaining({
        status: "active",
      }),
    );

    // Step 8: Verify user redirected to dashboard
    expect(redirect).toHaveBeenCalledWith("/dashboard");

    // Step 9: Verify profile data was saved
    expect(userDAL.updateUser).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      expect.objectContaining({
        firstName: mockOnboardingData.firstName,
        lastName: mockOnboardingData.lastName,
        phone: mockOnboardingData.phone,
        bio: mockOnboardingData.bio,
        profileImageUrl: mockOnboardingData.profileImageUrl,
      }),
    );

    // Step 10: Verify address was saved
    expect(userDAL.updateUserPrimaryAddress).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      mockOnboardingData.address,
    );
  });

  it("should handle onboarding workflow with validation errors", async () => {
    // Step 1: User fills out form with invalid data
    const formData = new FormData();
    formData.append("firstName", ""); // Invalid: empty
    formData.append("lastName", mockOnboardingData.lastName);
    formData.append("phone", "123"); // Invalid: too short
    formData.append("street", mockOnboardingData.address.street);
    formData.append("city", mockOnboardingData.address.city);
    formData.append("state", mockOnboardingData.address.state);
    formData.append("zipCode", mockOnboardingData.address.zipCode);
    formData.append("agreeToTerms", "true");

    vi.mocked(getCurrentUser).mockResolvedValue(mockUserForOnboarding);

    // Step 2: User submits form
    const result = await onboardingAction(null, formData);

    // Step 3: Verify error messages displayed (returned in result)
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toBe("Please check your information and try again.");

    // Step 4: Verify user stays on onboarding page (no redirect)
    expect(redirect).not.toHaveBeenCalled();

    // Step 5: User corrects errors
    const correctedFormData = new FormData();
    correctedFormData.append("firstName", mockOnboardingData.firstName);
    correctedFormData.append("lastName", mockOnboardingData.lastName);
    correctedFormData.append("phone", mockOnboardingData.phone);
    correctedFormData.append("street", mockOnboardingData.address.street);
    correctedFormData.append("city", mockOnboardingData.address.city);
    correctedFormData.append("state", mockOnboardingData.address.state);
    correctedFormData.append("zipCode", mockOnboardingData.address.zipCode);
    correctedFormData.append("agreeToTerms", "true");

    const mockUpdatedUser = {
      ...mockUserAfterOnboarding,
      status: "active",
    };

    vi.mocked(tryCatch)
      .mockResolvedValueOnce({
        data: mockUpdatedUser,
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any);

    // Step 6: User submits form again
    try {
      await onboardingAction(null, correctedFormData);
    } catch (error) {
      // redirect() throws
    }

    // Step 7: Verify onboarding completed
    expect(userDAL.updateUser).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("should complete onboarding workflow without profile image", async () => {
    // Step 1: User completes form without uploading image
    const formData = new FormData();
    formData.append("firstName", mockOnboardingDataMinimal.firstName);
    formData.append("lastName", mockOnboardingDataMinimal.lastName);
    formData.append("phone", mockOnboardingDataMinimal.phone);
    formData.append("bio", "");
    formData.append("profileImageUrl", ""); // No image
    formData.append("street", mockOnboardingDataMinimal.address.street);
    formData.append("city", mockOnboardingDataMinimal.address.city);
    formData.append("state", mockOnboardingDataMinimal.address.state);
    formData.append("zipCode", mockOnboardingDataMinimal.address.zipCode);
    formData.append("agreeToTerms", "true");

    const mockUpdatedUser = {
      ...mockUserForOnboarding,
      ...mockOnboardingDataMinimal,
      profileImageUrl: null,
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

    // Step 2: User submits form
    try {
      await onboardingAction(null, formData);
    } catch (error) {
      // redirect() throws
    }

    // Step 3: Verify onboarding completed
    expect(userDAL.updateUser).toHaveBeenCalledWith(
      mockUserForOnboarding.id,
      expect.objectContaining({
        firstName: mockOnboardingDataMinimal.firstName,
        lastName: mockOnboardingDataMinimal.lastName,
        phone: mockOnboardingDataMinimal.phone,
        profileImageUrl: "", // Empty string is valid
        status: "active",
      }),
    );

    // Step 4: Verify user redirected to dashboard
    expect(redirect).toHaveBeenCalledWith("/dashboard");

    // Step 5: Verify user initials would be used as fallback (handled by component, not action)
    // This is verified in component tests
  });
});
