/**
 * V2 Auth Utilities - Index
 *
 * Centralized exports for all auth utilities.
 */

// Validation utilities
export * from "./validation";

// Error handling utilities
export * from "./error-handling";

// Re-export types for convenience
export type {
  User,
  Community,
  GoogleUser,
  Address,
  SignupFlowState,
  SignupFlowActions,
  SignupFlowHook,
  AuthSession,
  AuthSessionActions,
  AuthSessionHook,
  ActionState,
  ValidationError,
  ServerError,
  FormField,
  FormState,
  LoadingState,
  ErrorState,
  RouteAccess,
  AuthGuardConfig,
  AuthEvent,
  AuthEventHandler,
  UseSignupFlowOptions,
  UseAuthSessionOptions,
} from "../types/auth.types";

// Re-export schema types
export type {
  SignupStep,
  SignupMethod,
  UserStatus,
  EmailSignupInput,
  GoogleSignupInput,
  OnboardingInput,
  JoinCodeInput,
  ServerActionResponse,
} from "../schemas/signup.schema";
