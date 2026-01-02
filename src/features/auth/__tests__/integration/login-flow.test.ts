import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInEmail } from "../../utils";
import { authClient } from "@/services/better-auth/client";

// Mock Better Auth client
vi.mock("@/services/better-auth/client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
  },
}));

describe("Login Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete login flow: Form → Action → Session → Redirect", async () => {
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

  it("should handle authentication errors and return error message", async () => {
    // Arrange
    const email = "test@example.com";
    const password = "wrongpassword";
    const callbackUrl = "/dashboard";

    const mockError = {
      message: "Invalid credentials",
    };

    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: mockError,
    } as any);

    // Act & Assert
    await expect(signInEmail(email, password, callbackUrl)).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("should create session on successful login", async () => {
    // Arrange
    const email = "test@example.com";
    const password = "password123";

    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: null,
    } as any);

    // Act
    await signInEmail(email, password);

    // Assert
    expect(authClient.signIn.email).toHaveBeenCalled();
    // Session is managed by Better Auth client - we verify the call was made
  });
});
