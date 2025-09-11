// Export all auth hooks
export { useSignup } from "./use-signup";
export { useGoogleSignin } from "./use-google-signin";
export { useSession, useRouteAccess, useAuthGuard } from "./use-session";
export {
  useFormState,
  useMultiStepForm,
  useFormSubmission,
} from "./use-form-state";
export { useErrorHandling, useFormErrorHandling } from "./use-error-handling";

// Re-export types for convenience
export type {
  ErrorType,
  ErrorSeverity,
  ErrorInfo,
  LoadingState,
} from "./use-error-handling";
