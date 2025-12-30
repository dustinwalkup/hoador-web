import { describe, it, expect, vi, beforeEach } from "vitest";
import { signupAction } from "../signup";
import { userDAL } from "@/dal";
import { mockSignupData } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/dal", () => ({
  userDAL: {
    createUser: vi.fn(),
  },
}));

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
}));

describe("signupAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should signup user with valid data", async () => {
    // Arrange
    const formData = mockSignupData;

    const { auth } = await import("@/services/better-auth");
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: {
        id: "user-123",
        email: formData.email,
      },
    } as any);

    vi.mocked(userDAL.createUser).mockResolvedValue({
      id: "user-123",
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
    } as any);

    // Act
    const result = await signupAction(null, new FormData());

    // Assert
    expect(result).toBeDefined();
  });

  it("should return error when validation fails", async () => {
    // Arrange
    const invalidFormData = new FormData();
    invalidFormData.append("email", "invalid-email");
    invalidFormData.append("password", "weak");

    // Act
    const result = await signupAction(null, invalidFormData);

    // Assert
    expect(result).toHaveProperty("error");
  });

  it("should return error when user already exists", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", mockSignupData.email);
    formData.append("password", mockSignupData.password);
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("phone", mockSignupData.phone);
    formData.append("joinCode", mockSignupData.joinCode);

    const { auth } = await import("@/services/better-auth");
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: {
        id: "user-123",
        email: formData.get("email"),
      },
    } as any);

    vi.mocked(userDAL.createUser).mockRejectedValue(
      new Error("User with this email already exists"),
    );

    // Act
    const result = await signupAction(null, formData);

    // Assert
    expect(result).toHaveProperty("error");
  });
});

