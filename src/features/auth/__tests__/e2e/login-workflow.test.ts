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

describe("Complete Login Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full login workflow", async () => {
    // Step 1: User navigates to login page
    // (Simulated by calling login function)

    // Step 2: User enters valid credentials
    const email = "test@example.com";
    const password = "password123";
    const callbackUrl = "/dashboard";

    // Step 3: User submits form
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: null,
    } as any);

    await signInEmail(email, password, callbackUrl);

    // Step 4: Verify authentication was called
    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email,
      password,
      callbackURL: callbackUrl,
    });

    // Step 5: Session persists (handled by Better Auth)
    // Step 6: User is redirected (handled by client-side code after successful login)
  });

  it("should handle login workflow with invalid credentials", async () => {
    // Step 1: User enters invalid credentials
    const email = "test@example.com";
    const password = "wrongpassword";

    // Step 2: User submits form
    const mockError = {
      message: "Invalid credentials",
    };

    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: mockError,
    } as any);

    // Step 3: Verify error is thrown (user stays on login page)
    await expect(signInEmail(email, password)).rejects.toThrow(
      "Invalid credentials",
    );
  });
});
