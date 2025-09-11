# Auth Signup Flow Implementation Plan V2 - Fixed Architecture

## 📋 Overview

Complete redesign of the auth signup flow addressing critical architectural issues found in V1. This implementation follows proper separation of concerns, unified state management, and schema-first design principles.

## 🚨 Issues Fixed from V1

### **Critical Problems Solved:**

1. **Flow Mismatch**: Component and hooks now use unified flow
2. **Dual Hook Anti-Pattern**: Single hook handles both email and Google signup
3. **Schema Mismatches**: All schemas align with implementation
4. **Missing Features**: Proper Google OAuth, email verification, onboarding
5. **State Management**: Clean separation between UI and business logic
6. **Validation Consistency**: Unified validation across client/server

## 🎯 Core Architecture Principles

### **1. Single Responsibility**

- **One Hook**: `useSignupFlow` handles all signup logic
- **Component**: Pure UI rendering with minimal state
- **Server Actions**: Schema-aligned data processing
- **Schemas**: Single source of truth for validation

### **2. Unified Flow Design**

```
Join Code → Method Selection → Profile Collection → Verification/Onboarding → Dashboard
     ↓            ↓                ↓                    ↓                ↓
  Validate     Email/Google      Collect Data      Email Verify      Complete
  Community    Selection         Address/Phone     or OAuth          Profile
```

### **3. Schema-First Architecture**

- Design schemas before implementation
- Server actions match schemas exactly
- Client validation mirrors server validation
- Type safety throughout

## 🔄 Unified User Flow

### **Email Signup Journey**

```
1. Enter Join Code → Validate Community
2. Select "Email" → Show email form
3. Fill Profile → Email, password, name, phone, address
4. Submit → Create account + Send verification email
5. Verify Email → Click link in email
6. Onboarding → Bio, profile photo (optional)
7. Dashboard → Full access
```

### **Google OAuth Journey**

```
1. Enter Join Code → Validate Community
2. Select "Google" → Redirect to Google OAuth
3. OAuth Callback → Auto-populate name, email, photo
4. Fill Missing → Phone, address (Google doesn't provide)
5. Submit → Create account (no email verification needed)
6. Onboarding → Bio, additional preferences
7. Dashboard → Full access
```

## 🏗️ Implementation Architecture

### **Phase 1: Schema & Type System** ⏳ **PENDING**

#### 1.1 Unified Schemas (`src/features/auth/schemas/signup.schema.ts`)

```typescript
// Base schemas
export const joinCodeSchema = z.object({
  joinCode: z.string().min(1, "Join code is required").max(20).trim(),
});

export const addressSchema = z.object({
  street: z.string().min(1, "Street address is required").max(255).trim(),
  city: z.string().min(1, "City is required").max(100).trim(),
  state: z.string().min(1, "State is required").max(50).trim().toUpperCase(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code")
    .trim(),
  unit: z.string().max(50).optional(), // Optional apartment/unit number
});

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(/^[\d\s\(\)\-\+\.]+$/, "Invalid phone number")
  .transform((val) => val.replace(/\D/g, "")) // Strip non-digits
  .refine((val) => val.length >= 10, "Phone must have 10+ digits")
  .refine((val) => val.length <= 11, "Phone must have 11 or fewer digits");

// Email signup schema
export const emailSignupSchema = z.object({
  email: z
    .string()
    .min(1, "Email required")
    .email("Invalid email")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be 8+ characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must have uppercase, lowercase, and number",
    ),
  firstName: z.string().min(1, "First name required").max(50).trim(),
  lastName: z.string().min(1, "Last name required").max(50).trim(),
  phone: phoneSchema,
  address: addressSchema,
  terms: z.boolean().refine((val) => val === true, "Must accept terms"),
});

// Google signup schema (after OAuth)
export const googleSignupSchema = z.object({
  phone: phoneSchema,
  address: addressSchema,
  // Google OAuth data (validated separately)
  googleData: z.object({
    id: z.string(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    profileImageUrl: z.string().url().optional(),
  }),
});

// Onboarding schema
export const onboardingSchema = z.object({
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  profileImageUrl: z.string().url().optional(),
  notifications: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
    })
    .optional(),
});

// Server action schemas (what gets sent to server)
export const serverEmailSignupSchema = emailSignupSchema.extend({
  joinCode: z.string(),
});

export const serverGoogleSignupSchema = googleSignupSchema.extend({
  joinCode: z.string(),
});

// Type exports
export type JoinCodeInput = z.infer<typeof joinCodeSchema>;
export type EmailSignupInput = z.infer<typeof emailSignupSchema>;
export type GoogleSignupInput = z.infer<typeof googleSignupSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ServerEmailSignupInput = z.infer<typeof serverEmailSignupSchema>;
export type ServerGoogleSignupInput = z.infer<typeof serverGoogleSignupSchema>;
```

#### 1.2 User Status Enum (`src/db/schemas/_enums.ts`)

```typescript
export const userStatusEnum = pgEnum("user_status", [
  "pending_verification", // Email signup - awaiting email verification
  "incomplete_profile", // Verified but missing onboarding
  "active", // Full access
  "suspended", // Admin action
  "inactive", // User deactivated
]);
```

### **Phase 2: Unified Hook Architecture** ⏳ **PENDING**

#### 2.1 Single Signup Hook (`src/features/auth/hooks/use-signup-flow.ts`)

```typescript
export type SignupStep =
  | "join-code"
  | "method-selection"
  | "email-details"
  | "google-oauth"
  | "google-details"
  | "email-verification"
  | "onboarding";

export type SignupMethod = "email" | "google";

interface SignupFlowState {
  currentStep: SignupStep;
  signupMethod: SignupMethod | null;
  joinCode: string | null;
  community: Community | null;
  googleUser: GoogleUser | null;
  emailSignupData: Partial<EmailSignupInput>;
  googleSignupData: Partial<GoogleSignupInput>;
  onboardingData: Partial<OnboardingInput>;
  validationErrors: Record<string, string>;
  isLoading: boolean;
  requiresEmailVerification: boolean;
}

export function useSignupFlow() {
  // Single source of truth for all signup state
  const [state, setState] = useState<SignupFlowState>({
    currentStep: "join-code",
    signupMethod: null,
    joinCode: null,
    community: null,
    googleUser: null,
    emailSignupData: {},
    googleSignupData: {},
    onboardingData: {},
    validationErrors: {},
    isLoading: false,
    requiresEmailVerification: false,
  });

  // Actions
  const validateJoinCode = async (joinCode: string) => {
    /* ... */
  };
  const selectSignupMethod = (method: SignupMethod) => {
    /* ... */
  };
  const submitEmailSignup = async (data: EmailSignupInput) => {
    /* ... */
  };
  const initiateGoogleOAuth = async () => {
    /* ... */
  };
  const completeGoogleSignup = async (data: GoogleSignupInput) => {
    /* ... */
  };
  const completeOnboarding = async (data: OnboardingInput) => {
    /* ... */
  };
  const goBack = () => {
    /* ... */
  };
  const reset = () => {
    /* ... */
  };

  return {
    // State (read-only)
    ...state,

    // Actions
    validateJoinCode,
    selectSignupMethod,
    submitEmailSignup,
    initiateGoogleOAuth,
    completeGoogleSignup,
    completeOnboarding,
    goBack,
    reset,

    // Computed properties
    canGoBack: state.currentStep !== "join-code",
    isEmailFlow: state.signupMethod === "email",
    isGoogleFlow: state.signupMethod === "google",
    currentData:
      state.signupMethod === "email"
        ? state.emailSignupData
        : state.googleSignupData,
  };
}
```

#### 2.2 Session Management Hook (`src/features/auth/hooks/use-auth-session.ts`)

```typescript
export function useAuthSession() {
  const { data: session, status } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: session?.user || null,
    isAuthenticated: !!session?.user,
    isLoading: status === "loading",
    userStatus: session?.user?.status || null,
    needsEmailVerification: session?.user?.status === "pending_verification",
    needsOnboarding: session?.user?.status === "incomplete_profile",
    isActive: session?.user?.status === "active",
  };
}
```

### **Phase 3: Server Actions** ⏳ **PENDING**

#### 3.1 Unified Email Signup (`src/features/auth/actions/signup-email.action.ts`)

```typescript
export async function signupEmailAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return await tryCatch(
    async () => {
      // Extract and validate data
      const rawData = {
        joinCode: formData.get("joinCode") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        phone: formData.get("phone") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zipCode: formData.get("zipCode") as string,
        unit: formData.get("unit") as string,
        terms: Boolean(formData.get("terms")),
      };

      // Validate with schema
      const validatedData = serverEmailSignupSchema.parse(rawData);

      // Validate community
      const community = await communityDAL.validateJoinCodeForSignup(
        validatedData.joinCode,
      );
      if (!community) {
        throw new Error("Invalid join code");
      }

      // Create user with Better Auth
      const authResult = await auth.api.signUpEmail({
        body: {
          email: validatedData.email,
          password: validatedData.password,
          name: `${validatedData.firstName} ${validatedData.lastName}`,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
        },
      });

      if (!authResult?.user) {
        throw new Error("Failed to create user account");
      }

      // Create user profile in our database
      await userDAL.createUserWithAddress(
        {
          id: authResult.user.id,
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          status: "pending_verification",
          address: {
            street: validatedData.street,
            city: validatedData.city,
            state: validatedData.state,
            zipCode: validatedData.zipCode,
            unit: validatedData.unit,
          },
        },
        community.id,
      );

      // Join community
      await communityDAL.joinCommunityForNewUser(
        authResult.user.id,
        community.id,
      );

      return {
        success: true,
        userId: authResult.user.id,
        requiresEmailVerification: true,
        message: "Account created! Please check your email to verify.",
      };
    },
    (error) => ({
      success: false,
      error: handleSignupError(error),
    }),
  );
}
```

#### 3.2 Google OAuth Completion (`src/features/auth/actions/signup-google.action.ts`)

```typescript
export async function completeGoogleSignupAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return await tryCatch(
    async () => {
      // Get current session (user should be authenticated via Google OAuth)
      const { data: session } = await auth.api.getSession();
      if (!session?.user) {
        throw new Error("No authenticated Google user found");
      }

      // Extract additional data
      const rawData = {
        joinCode: formData.get("joinCode") as string,
        phone: formData.get("phone") as string,
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zipCode: formData.get("zipCode") as string,
        unit: formData.get("unit") as string,
      };

      // Validate with schema
      const validatedData = serverGoogleSignupSchema.parse({
        ...rawData,
        googleData: {
          id: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          profileImageUrl: session.user.image,
        },
      });

      // Validate community
      const community = await communityDAL.validateJoinCodeForSignup(
        validatedData.joinCode,
      );
      if (!community) {
        throw new Error("Invalid join code");
      }

      // Update user profile in our database
      await userDAL.createUserWithAddress(
        {
          id: session.user.id,
          email: validatedData.googleData.email,
          firstName: validatedData.googleData.firstName,
          lastName: validatedData.googleData.lastName,
          phone: validatedData.phone,
          status: "incomplete_profile", // Google users skip email verification
          profileImageUrl: validatedData.googleData.profileImageUrl,
          address: {
            street: validatedData.street,
            city: validatedData.city,
            state: validatedData.state,
            zipCode: validatedData.zipCode,
            unit: validatedData.unit,
          },
        },
        community.id,
      );

      // Join community
      await communityDAL.joinCommunityForNewUser(session.user.id, community.id);

      return {
        success: true,
        userId: session.user.id,
        requiresOnboarding: true,
        message: "Account created! Please complete your profile.",
      };
    },
    (error) => ({
      success: false,
      error: handleSignupError(error),
    }),
  );
}
```

### **Phase 4: Component Architecture** ⏳ **PENDING**

#### 4.1 Main Signup Component (`src/features/auth/components/signup-flow.tsx`)

```typescript
export function SignupFlow() {
  const {
    currentStep,
    signupMethod,
    community,
    googleUser,
    validationErrors,
    isLoading,
    // Actions
    validateJoinCode,
    selectSignupMethod,
    submitEmailSignup,
    initiateGoogleOAuth,
    completeGoogleSignup,
    completeOnboarding,
    goBack,
    reset,
    // Computed
    canGoBack,
    isEmailFlow,
    isGoogleFlow,
  } = useSignupFlow();

  // Render current step
  switch (currentStep) {
    case 'join-code':
      return (
        <JoinCodeStep
          onSubmit={validateJoinCode}
          errors={validationErrors}
          isLoading={isLoading}
        />
      );

    case 'method-selection':
      return (
        <MethodSelectionStep
          community={community}
          onSelectMethod={selectSignupMethod}
          onBack={goBack}
          isLoading={isLoading}
        />
      );

    case 'email-details':
      return (
        <EmailDetailsStep
          onSubmit={submitEmailSignup}
          errors={validationErrors}
          isLoading={isLoading}
          onBack={goBack}
        />
      );

    case 'google-oauth':
      return (
        <GoogleOAuthStep
          onInitiate={initiateGoogleOAuth}
          isLoading={isLoading}
          onBack={goBack}
        />
      );

    case 'google-details':
      return (
        <GoogleDetailsStep
          googleUser={googleUser}
          onSubmit={completeGoogleSignup}
          errors={validationErrors}
          isLoading={isLoading}
          onBack={goBack}
        />
      );

    case 'email-verification':
      return (
        <EmailVerificationStep
          onResend={() => {/* resend email */}}
          isLoading={isLoading}
        />
      );

    case 'onboarding':
      return (
        <OnboardingStep
          onSubmit={completeOnboarding}
          errors={validationErrors}
          isLoading={isLoading}
          skipable={true}
        />
      );

    default:
      return <div>Invalid step</div>;
  }
}
```

#### 4.2 Individual Step Components

**Join Code Step** (`src/features/auth/components/steps/join-code-step.tsx`):

```typescript
interface JoinCodeStepProps {
  onSubmit: (joinCode: string) => Promise<void>;
  errors: Record<string, string>;
  isLoading: boolean;
}

export function JoinCodeStep({ onSubmit, errors, isLoading }: JoinCodeStepProps) {
  const [joinCode, setJoinCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(joinCode.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join Your Community</CardTitle>
        <CardDescription>
          Enter the join code provided by your community administrator
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-code">Community Join Code</Label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter your join code"
              className="text-center text-lg tracking-wider"
              disabled={isLoading}
            />
            {errors.joinCode && (
              <p className="text-destructive text-sm">{errors.joinCode}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !joinCode.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Method Selection Step** (`src/features/auth/components/steps/method-selection-step.tsx`):

```typescript
interface MethodSelectionStepProps {
  community: Community | null;
  onSelectMethod: (method: SignupMethod) => void;
  onBack: () => void;
  isLoading: boolean;
}

export function MethodSelectionStep({
  community,
  onSelectMethod,
  onBack,
  isLoading
}: MethodSelectionStepProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <CheckCircle className="text-primary h-5 w-5" />
          <span className="text-primary text-sm font-medium">
            {community?.name}
          </span>
        </div>
        <CardTitle className="text-2xl">Create Your Account</CardTitle>
        <CardDescription>
          Choose how you'd like to sign up
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="h-12 w-full justify-center gap-3"
          onClick={() => onSelectMethod('google')}
          disabled={isLoading}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">
              Or
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-12 w-full"
          onClick={() => onSelectMethod('email')}
          disabled={isLoading}
        >
          Continue with Email
        </Button>
      </CardContent>
      <CardFooter className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground"
          disabled={isLoading}
        >
          ← Back to join code
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### **Phase 5: Better Auth Integration** ⏳ **PENDING**

#### 5.1 Enhanced Better Auth Config (`src/services/better-auth/index.ts`)

```typescript
export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendEmailVerificationOnSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ["openid", "email", "profile"],
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "pending_verification",
      },
    },
  },
  callbacks: {
    after: {
      signUp: async (user, request) => {
        // Set initial status based on signup method
        if (request.body?.provider === "google") {
          await userDAL.updateUserStatus(user.id, "incomplete_profile");
        } else {
          await userDAL.updateUserStatus(user.id, "pending_verification");
        }
      },
      verifyEmail: async (user) => {
        // Update status after email verification
        await userDAL.updateUserStatus(user.id, "incomplete_profile");
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
```

#### 5.2 OAuth Callback Handler (`src/app/auth/signup/google/callback/page.tsx`)

```typescript
export default async function GoogleSignupCallback({
  searchParams,
}: {
  searchParams: { joinCode?: string };
}) {
  const { data: session } = await auth.api.getSession();

  if (!session?.user) {
    redirect('/signup?error=oauth-failed');
  }

  // If user already exists and is active, redirect to dashboard
  if (session.user.status === 'active') {
    redirect('/dashboard');
  }

  // Continue with signup flow
  return (
    <GoogleSignupCompletion
      googleUser={session.user}
      joinCode={searchParams.joinCode}
    />
  );
}
```

### **Phase 6: User Experience Flow** ⏳ **PENDING**

#### 6.1 Email Verification Handling

```typescript
// Email verification page
export default function EmailVerificationPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { token } = searchParams;

  useEffect(() => {
    if (token) {
      // Verify email with Better Auth
      auth.api.verifyEmail({ token })
        .then(() => {
          toast.success("Email verified! Completing your profile...");
          router.push('/auth/onboarding');
        })
        .catch(() => {
          toast.error("Invalid or expired verification link");
        });
    }
  }, [token]);

  return <EmailVerificationUI />;
}
```

#### 6.2 Route Protection

```typescript
// Middleware for protecting routes based on user status
export function withAuthStatus(allowedStatuses: UserStatus[]) {
  return function AuthWrapper({ children }: { children: React.ReactNode }) {
    const { user, userStatus, isLoading } = useAuthSession();

    if (isLoading) return <LoadingSpinner />;

    if (!user) {
      redirect('/login');
    }

    if (!allowedStatuses.includes(userStatus)) {
      // Redirect based on status
      if (userStatus === 'pending_verification') {
        redirect('/auth/verify-email');
      }
      if (userStatus === 'incomplete_profile') {
        redirect('/auth/onboarding');
      }
      redirect('/dashboard');
    }

    return children;
  };
}
```

## 📁 File Structure

```
src/features/auth/
├── schemas/
│   └── signup.schema.ts              [NEW] - Unified validation schemas
├── hooks/
│   ├── use-signup-flow.ts           [NEW] - Single signup hook
│   ├── use-auth-session.ts          [NEW] - Session management
│   └── index.ts                     [UPDATE] - Clean exports
├── actions/
│   ├── signup-email.action.ts       [REWRITE] - Schema-aligned email signup
│   ├── signup-google.action.ts      [REWRITE] - Proper Google OAuth completion
│   ├── complete-onboarding.action.ts [UPDATE] - Onboarding completion
│   └── verify-email.action.ts       [NEW] - Email verification handling
├── components/
│   ├── signup-flow.tsx              [NEW] - Main signup orchestrator
│   ├── steps/
│   │   ├── join-code-step.tsx       [NEW] - Join code validation
│   │   ├── method-selection-step.tsx [NEW] - Email vs Google choice
│   │   ├── email-details-step.tsx   [NEW] - Email signup form
│   │   ├── google-oauth-step.tsx    [NEW] - Google OAuth initiation
│   │   ├── google-details-step.tsx  [NEW] - Google additional data
│   │   ├── email-verification-step.tsx [NEW] - Email verification UI
│   │   └── onboarding-step.tsx      [NEW] - Profile completion
│   └── index.ts                     [UPDATE] - Component exports
├── utils/
│   ├── error-handling.ts            [UPDATE] - Consistent error handling
│   └── validation.ts                [NEW] - Shared validation utilities
└── types/
    └── auth.types.ts                [NEW] - Shared TypeScript types

src/app/auth/
├── signup/
│   ├── page.tsx                     [UPDATE] - Use new SignupFlow
│   └── google/
│       └── callback/
│           └── page.tsx             [NEW] - Google OAuth callback
├── verify-email/
│   └── page.tsx                     [NEW] - Email verification page
└── onboarding/
    └── page.tsx                     [NEW] - Onboarding page

src/services/better-auth/
├── index.ts                         [UPDATE] - Enhanced configuration
└── client.ts                        [UPDATE] - Client configuration
```

## 🎯 Implementation Phases

### **Phase 1: Foundation (Week 1)** ✅ **COMPLETE**

- [x] Create unified schemas with proper validation
- [x] Update user status enum and database schema
- [x] Set up Better Auth configuration with custom fields
- [x] Create type system and shared utilities

#### **Phase 1 Implementation Details:**

**1. Unified Schema System** (`src/features/auth/schemas/signup.schema.ts`)

- Complete Zod validation schemas for all signup flows
- Schema-first design - single source of truth for validation
- Proper transformations (phone number cleaning, case conversion)
- Comprehensive validation with user-friendly error messages
- Type exports for full TypeScript coverage

**2. Enhanced Better Auth Configuration** (`src/services/better-auth/`)

- Custom user fields aligned with our schemas
- Proper callbacks for status management after signup/verification
- Google OAuth configuration with profile data extraction
- Email verification with Resend integration
- Enhanced client configuration with error handling

**3. Comprehensive Type System** (`src/features/auth/types/auth.types.ts`)

- 400+ lines of TypeScript types covering all use cases
- Hook interfaces for clean API design
- Component prop types for consistent interfaces
- Server action types for proper data contracts
- Utility types for form state management

**4. Validation Utilities** (`src/features/auth/utils/validation.ts`)

- Schema-based validation functions for all forms
- Real-time field validation for better UX
- Phone number formatting utilities
- Password strength checking with feedback
- Form completion checking functions

**5. Error Handling System** (`src/features/auth/utils/error-handling.ts`)

- Error classification by type and severity
- User-friendly error messages for all scenarios
- Retry logic with exponential backoff
- Comprehensive error logging system
- Recovery strategies for different error types

**6. Files Created/Updated in Phase 1:**

**New Files:**

- `src/features/auth/schemas/signup.schema.ts` - Unified validation schemas (257 lines)
- `src/features/auth/types/auth.types.ts` - Comprehensive type system (417 lines)
- `src/features/auth/utils/validation.ts` - Validation utilities (486 lines)
- `src/features/auth/utils/error-handling.ts` - Error handling system (486 lines)
- `src/features/auth/utils/index.ts` - Utility exports

**Enhanced Files:**

- `src/services/better-auth/index.ts` - Enhanced configuration with callbacks
- `src/services/better-auth/client.ts` - Improved client setup with error handling
- `src/db/schemas/_enums.ts` - User status enum (already correctly implemented)

### **Phase 2: Core Logic (Week 2)**

- [ ] Implement `useSignupFlow` hook with unified state management
- [ ] Create `useAuthSession` hook for session management
- [ ] Rewrite server actions to align with schemas
- [ ] Implement proper error handling utilities

### **Phase 3: UI Components (Week 3)**

- [ ] Create main `SignupFlow` orchestrator component
- [ ] Implement individual step components
- [ ] Add Google OAuth callback handling
- [ ] Create email verification and onboarding pages

### **Phase 4: Integration & Testing (Week 4)**

- [ ] Integrate Better Auth with enhanced configuration
- [ ] Implement route protection based on user status
- [ ] Add comprehensive error handling and loading states
- [ ] End-to-end testing of both email and Google flows

## ✅ Success Criteria

### **Technical Requirements**

- [ ] Single hook manages all signup state
- [ ] All schemas align with implementation
- [ ] Proper Google OAuth integration with Better Auth
- [ ] Email verification flow works end-to-end
- [ ] User status-based route protection
- [ ] Consistent error handling across all layers

### **User Experience Requirements**

- [ ] Smooth flow progression without state conflicts
- [ ] Clear loading states and error messages
- [ ] Seamless Google OAuth experience
- [ ] Email verification with proper blocking
- [ ] Intuitive onboarding completion
- [ ] Mobile-responsive design

### **Code Quality Requirements**

- [ ] Type safety throughout the application
- [ ] Proper separation of concerns
- [ ] Testable architecture with clear interfaces
- [ ] Consistent validation between client and server
- [ ] Clean error handling with user-friendly messages

## 🚨 Risk Mitigation

### **Architecture Risks**

- **State Management**: Single source of truth prevents conflicts
- **Schema Mismatches**: Schema-first design ensures alignment
- **Flow Complexity**: Step-by-step implementation with clear interfaces

### **Integration Risks**

- **Better Auth**: Thorough testing with both email and Google flows
- **Google OAuth**: Proper callback handling and error states
- **Email Verification**: Clear user guidance and resend functionality

### **User Experience Risks**

- **Signup Abandonment**: Clear progress indicators and validation
- **Error Confusion**: Specific, actionable error messages
- **Mobile Issues**: Responsive design testing on multiple devices

## 📊 Key Improvements Over V1

1. **🎯 Unified Architecture**: Single hook, clear flow, no conflicts
2. **🔒 Schema Alignment**: All layers use same validation rules
3. **⚡ Better Performance**: Reduced re-renders and state management
4. **🛡️ Type Safety**: Comprehensive TypeScript coverage
5. **🎨 Better UX**: Clear step progression and error handling
6. **🧪 Testability**: Clean interfaces and separation of concerns
7. **📱 Mobile First**: Responsive design from the start
8. **🔧 Maintainability**: Clear file structure and documentation

This architecture addresses all critical issues from V1 and provides a solid foundation for a production-ready auth system.
