# Authentication Flow

## Overview

The authentication system uses a linear flow with server-side redirects based on user status. Each step is required and users cannot skip ahead.

## Flow Diagram

```
/signup → /verify-email → /join-code → /onboarding → /dashboard
```

## User Status Progression

| Status                 | Route           | Description                             |
| ---------------------- | --------------- | --------------------------------------- |
| `pending_verification` | `/verify-email` | Email not verified, must verify email   |
| `email_verified`       | `/join-code`    | Email verified, must join community     |
| `incomplete_profile`   | `/onboarding`   | Community joined, must complete profile |
| `active`               | `/dashboard`    | Profile complete, full access           |

## Route Protection

- **Middleware** handles all routing logic based on user status
- **Server actions** update user status and redirect automatically
- **Protected routes** require authentication and proper status

## Implementation

### Server Actions

- `actions/signup.ts` - Create account → `pending_verification` → redirect to `/verify-email`
- `actions/verify-email.ts` - Resend verification email
- `actions/join-community.ts` - Join community → `incomplete_profile` → redirect to `/onboarding`
- `actions/login.ts` - Sign in user → redirect to dashboard/callback

### Pages & Components

- `/signup` - `SimpleSignupForm` with `useActionState`
- `/verify-email` - `SimpleVerifyEmailForm` with resend functionality
- `/join-code` - `SimpleJoinCodeForm` with community joining
- `/onboarding` - Existing onboarding form (already uses server actions)
- `/login` - `SimpleLoginForm` with `useActionState`

### Key Features

- **Automatic redirects** based on user status
- **Server-side validation** and status updates
- **Rate-limited email** verification resends
- **Error handling** with toast notifications
- **Linear progression** - no skipping steps

## Status Transitions

```typescript
// 1. User signs up
signup() → status: "pending_verification"

// 2. User verifies email
verifyEmail() → status: "email_verified" → redirect("/join-code")

// 3. User joins community
joinCommunity() → status: "incomplete_profile" → redirect("/onboarding")

// 4. User completes onboarding
completeOnboarding() → status: "active" → redirect("/dashboard")
```

## Error Handling

- **Server actions** return error states for toast notifications
- **Middleware** handles authentication errors with login redirects
- **Rate limiting** prevents email spam with user-friendly messages
- **Validation errors** provide specific feedback to users
