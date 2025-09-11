/**
 * V2 Auth Type System - Shared TypeScript types
 *
 * This file contains all shared types for the auth system.
 * These types are used across components, hooks, and server actions.
 */

import type { User as BetterAuthUser } from "@/services/better-auth";
import type {
  SignupStep,
  SignupMethod,
  UserStatus,
  EmailSignupInput,
  GoogleSignupInput,
  OnboardingInput,
  ServerActionResponse,
} from "../schemas/signup.schema";

// ============================================================================
// CORE AUTH TYPES
// ============================================================================

/**
 * Extended user type with our custom fields
 */
export interface User extends BetterAuthUser {
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus; // Required field, not optional
  bio?: string;
  profileImageUrl?: string;
  stripeCustomerId?: string;
  idVerified: boolean; // Required field, not optional
  addressVerified: boolean; // Required field, not optional
  lastLoginAt?: Date;
}

/**
 * Community information for signup
 */
export interface Community {
  id: string;
  name: string;
  imageUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  description?: string;
  memberCount?: number;
}

/**
 * Google OAuth user data (from Better Auth callback)
 */
export interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}

/**
 * Address information
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  unit?: string;
}

// ============================================================================
// SIGNUP FLOW STATE TYPES
// ============================================================================

/**
 * Complete signup flow state
 */
export interface SignupFlowState {
  // Navigation state
  currentStep: SignupStep;
  signupMethod: SignupMethod | null;

  // Data state
  joinCode: string | null;
  community: Community | null;
  googleUser: GoogleUser | null;

  // Form data
  emailSignupData: Partial<EmailSignupInput>;
  googleSignupData: Partial<GoogleSignupInput>;
  onboardingData: Partial<OnboardingInput>;

  // UI state
  validationErrors: Record<string, string>;
  isLoading: boolean;

  // Flow state
  requiresEmailVerification: boolean;
  requiresOnboarding: boolean;
}

/**
 * Signup flow actions
 */
export interface SignupFlowActions {
  // Navigation actions
  validateJoinCode: (joinCode: string) => Promise<void>;
  selectSignupMethod: (method: SignupMethod) => void;
  goBack: () => void;
  reset: () => void;

  // Signup actions
  submitEmailSignup: (data: EmailSignupInput) => Promise<void>;
  initiateGoogleOAuth: () => Promise<void>;
  completeGoogleSignup: (data: GoogleSignupInput) => Promise<void>;
  completeOnboarding: (data: OnboardingInput) => Promise<void>;

  // Utility actions
  updateFormData: (updates: Partial<SignupFlowState>) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearErrors: () => void;
}

/**
 * Complete signup flow hook return type
 */
export interface SignupFlowHook extends SignupFlowState, SignupFlowActions {
  // Computed properties
  canGoBack: boolean;
  isEmailFlow: boolean;
  isGoogleFlow: boolean;
  isJoinCodeValid: boolean;
  isProfileComplete: boolean;
  currentFormData: Partial<EmailSignupInput> | Partial<GoogleSignupInput>;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Auth session state
 */
export interface AuthSession {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userStatus: UserStatus | null;
  needsEmailVerification: boolean;
  needsOnboarding: boolean;
  isActive: boolean;
}

/**
 * Auth session actions
 */
export interface AuthSessionActions {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
}

/**
 * Complete auth session hook return type
 */
export interface AuthSessionHook extends AuthSession, AuthSessionActions {
  // Helper methods
  requireAuth: () => User;
  requireActiveUser: () => User;
  checkUserStatus: (requiredStatus: UserStatus) => boolean;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

/**
 * Base step component props
 */
export interface BaseStepProps {
  isLoading: boolean;
  errors: Record<string, string>;
  onBack?: () => void;
}

/**
 * Join code step props
 */
export interface JoinCodeStepProps extends BaseStepProps {
  onSubmit: (joinCode: string) => Promise<void>;
  initialValue?: string;
}

/**
 * Method selection step props
 */
export interface MethodSelectionStepProps extends BaseStepProps {
  community: Community | null;
  onSelectMethod: (method: SignupMethod) => void;
}

/**
 * Email details step props
 */
export interface EmailDetailsStepProps extends BaseStepProps {
  onSubmit: (data: EmailSignupInput) => Promise<void>;
  initialData?: Partial<EmailSignupInput>;
}

/**
 * Google OAuth step props
 */
export interface GoogleOAuthStepProps extends BaseStepProps {
  community: Community | null;
  onInitiate: () => Promise<void>;
}

/**
 * Google details step props
 */
export interface GoogleDetailsStepProps extends BaseStepProps {
  googleUser: GoogleUser | null;
  onSubmit: (data: GoogleSignupInput) => Promise<void>;
  initialData?: Partial<GoogleSignupInput>;
}

/**
 * Email verification step props
 */
export interface EmailVerificationStepProps extends BaseStepProps {
  email?: string;
  onResend: () => Promise<void>;
  canResend: boolean;
  resendCooldown: number;
}

/**
 * Onboarding step props
 */
export interface OnboardingStepProps extends BaseStepProps {
  user: User | null;
  onSubmit: (data: OnboardingInput) => Promise<void>;
  onSkip?: () => Promise<void>;
  skipable?: boolean;
  initialData?: Partial<OnboardingInput>;
}

// ============================================================================
// SERVER ACTION TYPES
// ============================================================================

/**
 * Server action state (for useActionState)
 */
export interface ActionState extends ServerActionResponse {
  // Additional fields for specific actions
  userId?: string;
  requiresVerification?: boolean;
  requiresOnboarding?: boolean;
  communityJoined?: boolean;
  community?: Community;
}

/**
 * Validation error from server
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Server error response
 */
export interface ServerError {
  message: string;
  code?: string;
  field?: string;
  validationErrors?: ValidationError[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Form field state
 */
export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

/**
 * Form state for any object
 */
export type FormState<T> = {
  [K in keyof T]: FormField<T[K]>;
};

/**
 * Loading state for different operations
 */
export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  message?: string;
}

/**
 * Error state with severity levels
 */
export interface ErrorState {
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  field?: string;
  code?: string;
  retryable?: boolean;
}

// ============================================================================
// ROUTE PROTECTION TYPES
// ============================================================================

/**
 * Route access requirements
 */
export interface RouteAccess {
  requireAuth: boolean;
  allowedStatuses?: UserStatus[];
  redirectTo?: string;
  fallbackComponent?: React.ComponentType;
}

/**
 * Auth guard configuration
 */
export interface AuthGuardConfig extends RouteAccess {
  loading?: React.ComponentType;
  unauthorized?: React.ComponentType;
  checkInterval?: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Auth events that can be emitted
 */
export type AuthEvent =
  | { type: "signup_started"; method: SignupMethod }
  | { type: "signup_completed"; userId: string; method: SignupMethod }
  | { type: "email_verified"; userId: string }
  | { type: "onboarding_completed"; userId: string }
  | { type: "signin"; userId: string }
  | { type: "signout"; userId: string }
  | { type: "session_expired"; userId: string };

/**
 * Auth event handler
 */
export type AuthEventHandler = (event: AuthEvent) => void;

// ============================================================================
// HOOK OPTIONS TYPES
// ============================================================================

/**
 * Options for useSignupFlow hook
 */
export interface UseSignupFlowOptions {
  initialStep?: SignupStep;
  initialJoinCode?: string;
  enableAnalytics?: boolean;
  redirectOnComplete?: string;
  onStepChange?: (step: SignupStep) => void;
  onError?: (error: ErrorState) => void;
}

/**
 * Options for useAuthSession hook
 */
export interface UseAuthSessionOptions {
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  onStatusChange?: (status: UserStatus | null) => void;
  onSignOut?: () => void;
}

// ============================================================================
// RE-EXPORTS FROM SCHEMAS
// ============================================================================

// Re-export schema types for convenience
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
