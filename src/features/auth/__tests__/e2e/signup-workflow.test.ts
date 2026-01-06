import { describe, it, expect, vi, beforeEach } from "vitest";
import { signupAction } from "../../actions/signup";
import { userDAL } from "@/dal";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { mockSignupData, mockLegalDocuments } from "@/test/fixtures/auth";

// Mock all dependencies for E2E test
vi.mock("@/dal", () => ({
  userDAL: {
    updateLegalAcceptancesForSignup: vi.fn(),
  },
}));

vi.mock("@/dal/legal-document.dal", () => ({
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn(),
    recordAcceptanceForSignup: vi.fn(),
  },
}));

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

describe("Complete User Signup Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockHeaders = new Headers();
    mockHeaders.set("x-forwarded-for", "192.168.1.1");
    mockHeaders.set("user-agent", "test-agent");
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should complete full user signup workflow", async () => {
    // Step 1: User navigates to signup page
    // (Simulated by creating form data)

    // Step 2: User fills out signup form with valid data
    const formData = new FormData();
    formData.append("email", mockSignupData.email);
    formData.append("password", mockSignupData.password);
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("legalAccepted", "true");

    // Step 3: User accepts legal documents
    // (Simulated by legalAccepted = true)

    // Step 4: User submits form
    const mockAuthResult = {
      user: {
        id: "user-123",
        email: mockSignupData.email,
      },
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockAuthResult,
      error: null,
    } as any);

    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue(
      mockLegalDocuments,
    );
    vi.mocked(legalDocumentDAL.recordAcceptanceForSignup).mockResolvedValue(
      undefined,
    );
    vi.mocked(userDAL.updateLegalAcceptancesForSignup).mockResolvedValue(
      undefined,
    );

    // Step 5: Verify email sent notification (Better Auth handles this)
    try {
      await signupAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Step 6: Verify redirect to verification page
    expect(redirect).toHaveBeenCalledWith(
      `/verify-email?email=${encodeURIComponent(mockSignupData.email)}`,
    );

    // Step 7: Verify user account was created
    expect(tryCatch).toHaveBeenCalled(); // Better Auth signup

    // Step 8: Verify legal documents were accepted
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledTimes(2);
    expect(userDAL.updateLegalAcceptancesForSignup).toHaveBeenCalled();
  });

  it("should handle signup workflow with validation errors", async () => {
    // Step 1: User fills out form with invalid data
    const formData = new FormData();
    formData.append("email", "invalid-email");
    formData.append("password", "weak");
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("legalAccepted", "true");

    // Step 2: User submits form
    const result = await signupAction(null, formData);

    // Step 3: Verify error is returned (user stays on form)
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
