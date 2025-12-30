export const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "John Doe",
    emailVerified: true,
  },
  session: {
    id: "session-123",
    userId: "user-123",
    expiresAt: new Date("2024-12-31"),
  },
};

export const mockAdminSession = {
  user: {
    id: "admin-123",
    email: "admin@example.com",
    name: "Admin User",
    emailVerified: true,
    role: "admin",
  },
  session: {
    id: "admin-session-123",
    userId: "admin-123",
    expiresAt: new Date("2024-12-31"),
  },
};

export const mockSignupData = {
  email: "newuser@example.com",
  password: "SecurePassword123!",
  firstName: "New",
  lastName: "User",
  phone: "5551234567",
  joinCode: "COMMUNITY123",
};

export const mockSignupDataInvalid = {
  email: "invalid-email",
  password: "weak", // Too weak
  firstName: "", // Empty
  lastName: "",
  phone: "123", // Invalid
};

export const mockLoginData = {
  email: "test@example.com",
  password: "SecurePassword123!",
};

export const mockForgotPasswordData = {
  email: "test@example.com",
};

export const mockResetPasswordData = {
  token: "reset-token-123",
  password: "NewSecurePassword123!",
  confirmPassword: "NewSecurePassword123!",
};

export const mockJoinCode = "COMMUNITY123";

export const mockJoinCodeInvalid = "INVALID123";
