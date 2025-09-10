# Auth Signup Flow Implementation Plan

## 📋 Overview

Implement complete create account flow using Better Auth with email/password and Google OAuth, including community joining and email verification.

## 🎯 Requirements Summary

- **Community joining**: Required during signup via join code
- **Address collection**: Primary address required during signup
- **Phone**: Required field
- **Email verification**: Required for email signups, not for Google OAuth
- **Google OAuth**: Auto-populate profile photo and parse name, fallback to manual entry
- **User status**: Industry best practice implementation
- **Error handling**: Better Auth linking for duplicate emails, standard error messages
- **Post-signup**: Brief onboarding for remaining account details after verification

## 🚀 Implementation Phases

### **Phase 1: Database & DAL Updates**

#### 1.1 Update User DAL (`src/dal/user.dal.ts`)

```typescript
// New methods needed:
-createUserWithProfile(userData, addressData, communityId) -
  updateUserProfileFields(userId, profileData) -
  getUserByEmailForAuth(email) -
  updateUserStatus(userId, status) -
  completeUserOnboarding(userId, onboardingData);
```

#### 1.2 Update Community DAL (`src/dal/community.dal.ts`)

```typescript
// Enhance existing methods:
- getCommunityByJoinCode() - Add active status check
- joinCommunityByCode() - Integration with user creation flow
```

#### 1.3 Address Management in User DAL (`src/dal/user.dal.ts`)

```typescript
// Address methods integrated into User DAL:
-createUserWithAddress(userData, addressData, communityId) -
  updateUserAddress(userId, addressData) -
  getUserWithAddress(userId) -
  validateAndFormatAddress(addressData) -
  formatPhoneNumber(phoneNumber); // Format as (555) 123-4567
```

#### 1.4 User Status Enum Updates (`src/db/schemas/_enums.ts`)

```typescript
// Industry best practice user statuses:
- pending_verification (email not verified)
- active (verified and onboarded)
- incomplete_profile (verified but missing onboarding data)
- suspended (admin action)
- inactive (user deactivated)
```

### **Phase 2: Better Auth Integration**

#### 2.1 Better Auth Client Enhancement (`src/services/better-auth/client.ts`)

```typescript
// Add configuration and utilities:
- Base URL configuration
- Error handling utilities
- Custom hooks exports
```

#### 2.2 Better Auth Server Configuration (`src/services/better-auth/index.ts`)

```typescript
// Enhance existing config:
- Add custom user fields (firstName, lastName, phone)
- Configure email verification with Resend (24hr expiry)
- Add Google OAuth profile mapping with photo/phone permissions
- Configure OAuth redirect URLs (dev/prod)
- Add custom callbacks for user creation
```

#### 2.3 Auth Utils Replacement (`src/features/auth/auth.utils.ts`)

```typescript
// Replace mock auth with Better Auth:
- getCurrentUser() -> Use Better Auth session
- requireAuth() -> Better Auth session validation
- getCurrentUserId() -> Extract from Better Auth session
- requireVerifiedUser() -> Check email verification status
```

### **Phase 3: Server Actions & Form Schemas**

#### 3.1 Form Validation Schemas (`src/features/auth/form-schema/`)

```typescript
// signup-schema.ts - Zod schemas:
-joinCodeSchema -
  emailSignupSchema -
  profileDetailsSchema -
  addressSchema -
  onboardingSchema;
```

#### 3.2 Server Actions (`src/features/auth/actions/`)

```typescript
// validate-join-code.action.ts
- validateJoinCodeAction(joinCode) -> Community validation

// signup-email.action.ts
- signupEmailAction(formData) -> Email/password signup with profile

// signup-google.action.ts
- handleGoogleSignupAction(googleData, additionalData) -> Google OAuth completion

// complete-onboarding.action.ts
- completeOnboardingAction(userId, onboardingData) -> Post-verification onboarding
```

### **Phase 4: React Hooks & Client Logic**

#### 4.1 Authentication Hooks (`src/features/auth/hooks/`)

```typescript
// use-signup.ts - Email signup hook
- Form state management
- Error handling with toast
- Loading states

// use-google-signin.ts - Google OAuth hook
- Google OAuth flow
- Profile data parsing
- Additional data collection

// use-session.ts - Session management
- Better Auth session integration
- User status checking
- Verification status
```

### **Phase 5: Component Implementation**

#### 5.1 Enhanced Signup Form (`src/features/auth/components/signup-form.tsx`)

```typescript
// Updated 3-step flow:
Step 1: Community Code Validation
Step 2: Auth Method Selection (Email/Google)
Step 3: Profile Details (name, phone, address)

// Features:
- Real Better Auth integration
- Form validation with Zod
- Loading states and error handling
- Google profile data auto-population
- Address collection
- Toast notifications with Sonner
```

#### 5.2 Onboarding Component (`src/features/auth/components/onboarding-form.tsx`) [NEW]

```typescript
// Post-verification onboarding (required before app access):
- Bio/introduction text (optional, 500 character limit)
- Profile photo upload (if not from Google)
- Phone number (if not collected during signup)
- Any other essential fields
- Straightforward form - expandable later
```

### **Phase 6: User Experience & Flow**

#### 6.1 Email Verification Flow

```typescript
// Email signup flow:
1. User signs up -> pending_verification status
2. Verification email sent via Better Auth (expires after 24 hours)
3. User clicks verification link
4. Status updated to incomplete_profile
5. Redirect to mandatory onboarding (blocks all other access)
6. After onboarding completion -> active status
7. Resend verification email option available
8. Unverified users get friendly message to check email
```

#### 6.2 Google OAuth Flow

```typescript
// Google signup flow:
1. User selects Google OAuth
2. Google authentication with profile photo and phone permissions
3. Auto-populate name, email, profile photo from Google
4. Collect missing fields (phone if not available, address)
5. Create user with incomplete_profile status (no email verification needed)
6. Auto-join community
7. Redirect to mandatory onboarding (blocks all other access)
8. After onboarding completion -> active status
```

#### 6.3 Error Handling Strategy

```typescript
// Duplicate email handling:
- Email signup: Offer Better Auth account linking or password reset
- Google signup: Automatic linking if same email exists

// Network/API errors:
- Toast notifications with Sonner
- Form validation errors inline
- Graceful degradation with retry options

// Address validation:
- Basic format validation for all required fields
- Phone number formatting as (555) 123-4567
- Google profile photo stored as URL (best practice)
- Email service configured with Resend
```

## 📁 File Structure

```
src/dal/
├── user.dal.ts                         [UPDATE] - Enhanced user operations + address management
└── community.dal.ts                    [UPDATE] - Community joining integration

src/features/auth/
├── actions/
│   ├── validate-join-code.action.ts    [NEW] - Community validation
│   ├── signup-email.action.ts          [NEW] - Email signup
│   ├── signup-google.action.ts         [NEW] - Google OAuth completion
│   └── complete-onboarding.action.ts   [NEW] - Post-verification onboarding
├── components/
│   ├── signup-form.tsx                 [UPDATE] - Full Better Auth integration
│   ├── onboarding-form.tsx             [NEW] - Post-signup onboarding
│   └── index.ts                        [UPDATE] - Export new components
├── form-schema/
│   └── signup-schema.ts                [NEW] - Zod validation schemas
├── hooks/
│   ├── use-signup.ts                   [NEW] - Email signup hook
│   ├── use-google-signin.ts            [NEW] - Google OAuth hook
│   └── use-session.ts                  [NEW] - Session management
└── auth.utils.ts                       [UPDATE] - Better Auth integration

src/services/better-auth/
├── client.ts                           [UPDATE] - Enhanced configuration
└── index.ts                            [UPDATE] - Server config with custom fields

src/db/schemas/
└── _enums.ts                           [UPDATE] - User status enum
```

## 🔄 User Flow Diagrams

### Email Signup Flow

```
Join Code → Email/Password → Profile Details → Email Verification → Onboarding → Dashboard
     ↓            ↓              ↓                    ↓              ↓
Community     User Created    Address Added    Status: Active   Complete Profile
Validated   Status: Pending   Community Join   Email Verified   Bio/Preferences
```

### Google OAuth Flow

```
Join Code → Google OAuth → Profile Details → Community Join → Onboarding → Dashboard
     ↓           ↓             ↓                 ↓             ↓
Community   Auto-populate   Missing Fields   Status: Active   Complete Profile
Validated   Name/Photo     Phone/Address    Auto-verified    Bio/Preferences
```

## 📋 **Implementation Checklist**

### **Phase 1: Database & DAL Updates** ✅ **COMPLETE**

- [x] Update user status enum with industry best practices
- [x] Add phone number formatting utility (static method)
- [x] Create address validation and formatting methods
- [x] Add `createUserWithAddress()` method with atomic transactions
- [x] Add `updateUserAddress()` method for existing users
- [x] Add `getUserWithAddress()` method for auth flows
- [x] Add `getUserByEmailForAuth()` method (no auth required)
- [x] Add `updateUserStatus()` method with proper typing
- [x] Add `completeUserOnboarding()` method
- [x] Update Community DAL with `validateJoinCodeForSignup()` method
- [x] Update Community DAL with `joinCommunityForNewUser()` method
- [x] Create new DTOs: `CreateUserWithAddressDTO`, `AddressData`
- [x] Test phone number formatting utility

### **Phase 2: Better Auth Integration** ✅ **COMPLETE**

- [x] Update Better Auth server configuration
- [x] Add custom user fields (firstName, lastName, phone)
- [x] Configure email verification with Resend (24hr expiry)
- [x] Add Google OAuth profile mapping with photo/phone permissions
- [x] Configure OAuth redirect URLs (dev/prod)
- [x] Add custom callbacks for user creation
- [x] Update Better Auth client configuration
- [x] Replace mock auth utils with Better Auth session management

### **Phase 3: Server Actions & Form Schemas** ✅ **COMPLETE**

- [x] Create Zod validation schemas for signup forms
- [x] Create `validateJoinCodeAction()` server action
- [x] Create `signupEmailAction()` server action
- [x] Create `signupGoogleAction()` server action
- [x] Create `completeOnboardingAction()` server action
- [x] Implement proper error handling with toast notifications

### **Phase 4: React Hooks & Client Logic** ⏳ **PENDING**

- [ ] Create `useSignup()` hook for email signup
- [ ] Create `useGoogleSignin()` hook for OAuth flow
- [ ] Create `useSession()` hook for session management
- [ ] Implement form state management
- [ ] Add loading states and error handling

### **Phase 5: Component Implementation** ⏳ **PENDING**

- [ ] Update SignupForm component with Better Auth integration
- [ ] Add real form validation with Zod schemas
- [ ] Implement Google OAuth flow in signup form
- [ ] Add address collection to signup form
- [ ] Create OnboardingForm component for post-verification
- [ ] Add toast notifications with Sonner
- [ ] Implement loading states and error handling

### **Phase 6: User Experience & Flow** ⏳ **PENDING**

- [ ] Implement email verification flow (24hr expiry, resend capability)
- [ ] Implement Google OAuth flow with profile auto-population
- [ ] Add mandatory onboarding after verification
- [ ] Implement user status-based access control
- [ ] Add proper error handling for all scenarios
- [ ] Test end-to-end signup flows (email & Google)
- [ ] Add mobile responsiveness testing

## 🎯 Success Criteria

### Technical

- [ ] Better Auth fully integrated with custom user fields
- [ ] Email verification working for email signups
- [ ] Google OAuth with profile auto-population
- [ ] Community joining during signup process
- [ ] Address collection and storage
- [ ] Proper error handling with toast notifications
- [ ] User status management following industry best practices

### User Experience

- [ ] Smooth 3-step signup process
- [ ] Clear error messages and loading states
- [ ] Seamless Google OAuth experience
- [ ] Email verification with proper blocking
- [ ] Intuitive onboarding flow
- [ ] Responsive design on all devices

### Data Integrity

- [ ] Atomic user creation with community joining
- [ ] Proper address validation and storage
- [ ] User status consistency
- [ ] Email uniqueness with proper duplicate handling
- [ ] Phone number formatting and storage

## 🚨 Risk Mitigation

### Technical Risks

- **Better Auth integration complexity**: Thorough testing with both email and Google flows
- **Email delivery issues**: Configure proper SMTP and test verification emails
- **Google OAuth configuration**: Verify all OAuth settings and callbacks
- **Database transactions**: Ensure atomic operations for user creation + community joining

### User Experience Risks

- **Signup abandonment**: Keep form steps minimal and progress indicators clear
- **Verification email delays**: Clear messaging about checking spam folders
- **Google OAuth failures**: Fallback to email signup option
- **Mobile responsiveness**: Test on various screen sizes

## 📊 Implementation Timeline

### Week 1: Foundation (Phase 1-2)

- DAL updates and database schema enhancements
- Better Auth server/client configuration
- Auth utils replacement

### Week 2: Core Logic (Phase 3-4)

- Server actions implementation
- Form schemas and validation
- React hooks development

### Week 3: UI Implementation (Phase 5)

- Signup form enhancement
- Onboarding component creation
- Error handling and loading states

### Week 4: Testing & Polish (Phase 6)

- End-to-end flow testing
- Error scenario testing
- Mobile responsiveness
- Performance optimization

## 🔧 Technical Notes

### Better Auth Configuration

- Custom user fields: firstName, lastName, phone
- Email verification enabled for email signups
- Google OAuth with profile data mapping
- Session management with user status checking

### Database Considerations

- User creation + community joining as atomic transaction
- Address as separate table with foreign key to user
- User status enum for proper state management
- Better Auth tables integration with custom schema

### Security Considerations

- Email verification required for email signups
- Phone number format validation
- Address data sanitization
- Proper session management and CSRF protection

## ✅ **Implementation Decisions Made**

### **Onboarding Flow:**

- ✅ Mandatory onboarding after email verification, before any app access
- ✅ Simple onboarding: Bio, profile photo (if not from Google), essential fields only
- ✅ No notification preferences or surveys for now (expandable later)

### **Better Auth Configuration:**

- ✅ Email verification expires after 24 hours (best practice)
- ✅ Allow resending verification emails
- ✅ Unverified users see friendly message with resend option

### **Google OAuth Scope:**

- ✅ Request profile photo and phone number permissions
- ✅ Auto-populate available data, collect missing fields manually

### **User Status Implementation:**

- ✅ Status flow:
  - Email Signup: `pending_verification` → `incomplete_profile` → `active`
  - Google Signup: `incomplete_profile` → `active`
- ✅ Access control:
  - `pending_verification`: Block all access except verification page
  - `incomplete_profile`: Force mandatory onboarding completion
  - `active`: Full access to all features

### **Address Collection:**

- ✅ Address management integrated into User DAL (not separate DAL)
- ✅ Basic format validation for all address fields
- ✅ All fields required: street, city, state, zip code
- ✅ Apartment/unit number optional
- ✅ ZIP code auto-population deferred for later implementation

### **Technical Implementation:**

- ✅ Phone number formatting as (555) 123-4567, no uniqueness validation needed
- ✅ Community edge cases not a concern for initial implementation
- ✅ Atomic user creation + community joining using database transactions (best practice)
- ✅ Google profile photo stored as URL (best practice), users can update later
- ✅ Toast notifications using Sonner with standard error messages
- ✅ Email verification with Resend service (24hr expiry, resend capability)
- ✅ Google OAuth redirect URLs: dev + prod (https://hoador-web.vercel.app/api/auth/callback/google)
- ✅ Bio field: optional with 500 character limit
