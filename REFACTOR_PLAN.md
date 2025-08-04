# Feature-Based Folder Structure Refactor Plan

## Overview

Refactor the Next.js project to use a feature-based folder structure as described in "This Folder Structure Makes Me 100% More Productive" by Web Dev Simplified.

## Goals

- Group all code by feature, not by technology
- Each feature should have its own folder under `src/features/`
- Inside each feature folder, include subfolders for components, server (API, actions, logic), schemas, and other relevant code
- Shared/global code should remain in top-level folders like `src/components/`, `src/lib/`, etc.
- The app folder should only be responsible for routing and rendering feature components
- Remove cross-feature imports so features only import from shared/global code or within themselves
- Update all import paths to reflect the new structure
- Move code used by multiple features to shared/global folders

## Proposed New Structure

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── auth.dal.ts
│   │   ├── auth.constants.ts
│   │   ├── auth.utils.ts
│   │   └── auth.seed.ts
│   ├── tools/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── tools.dal.ts
│   │   ├── tools.constants.ts
│   │   ├── tools.utils.ts
│   │   └── tools.seed.ts
│   ├── rentals/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── rentals.dal.ts
│   │   ├── rentals.constants.ts
│   │   ├── rentals.utils.ts
│   │   └── rentals.seed.ts
│   ├── messaging/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── messaging.dal.ts
│   │   ├── messaging.constants.ts
│   │   ├── messaging.utils.ts
│   │   └── messaging.seed.ts
│   ├── reviews/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── reviews.dal.ts
│   │   ├── reviews.constants.ts
│   │   ├── reviews.utils.ts
│   │   └── reviews.seed.ts
│   ├── payments/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── payments.dal.ts
│   │   ├── payments.constants.ts
│   │   ├── payments.utils.ts
│   │   └── payments.seed.ts
│   ├── notifications/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── notifications.dal.ts
│   │   ├── notifications.constants.ts
│   │   ├── notifications.utils.ts
│   │   └── notifications.seed.ts
│   ├── users/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── schemas/
│   │   ├── types/
│   │   ├── users.dal.ts
│   │   ├── users.constants.ts
│   │   ├── users.utils.ts
│   │   └── users.seed.ts
│   ├── explore/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── types/
│   │   ├── explore.constants.ts
│   │   └── explore.utils.ts
│   └── dashboard/
│       ├── components/
│       ├── server/
│       │   ├── actions/
│       │   └── api/
│       ├── types/
│       ├── dashboard.constants.ts
│       └── dashboard.utils.ts
├── services/
│   ├── ai/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── ai.service.ts
│   ├── geocoding/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── geocoding.service.ts
│   ├── image-processing/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── image-processing.service.ts
│   └── payment-processing/
│       ├── components/
│       ├── hooks/
│       ├── types/
│       └── payment-processing.service.ts
├── components/
│   ├── ui/
│   └── layout/
├── lib/
│   ├── db/
│   ├── auth/
│   ├── utils/
│   ├── constants/
│   └── types/
├── hooks/
└── app/
    ├── (auth)/
    ├── dashboard/
    ├── explore/
    ├── tools/
    └── globals.css
```

## Current Features Identified

1. **Authentication** - Login/signup, user sessions
2. **Tools** - Tool management, CRUD operations, images
3. **Rentals** - Rental requests, approvals, status management
4. **Messaging** - Conversations, messages between users
5. **Reviews** - User reviews and ratings
6. **Payments** - Payment processing and billing
7. **Notifications** - User notifications system
8. **User Profiles** - User management, profiles, preferences
9. **Explore** - Tool discovery and search
10. **Dashboard** - User dashboard and analytics

## Refactor Checklist (One Feature at a Time)

### Phase 1: Planning & Analysis ✅

- [x] Analyze current codebase structure
- [x] Identify features and dependencies
- [x] Create refactor plan
- [x] Document current structure

### Phase 2: Shared Infrastructure Setup

- [ ] Move database setup (`db/`) to `lib/db/`
- [ ] Move authentication utilities to `lib/auth/`
- [ ] Move global utilities to `lib/utils/`
- [ ] Move global constants to `lib/constants/`
- [ ] Move global hooks to `hooks/`
- [ ] Move global types to `lib/types/`
- [ ] Move UI components to `components/ui/`
- [ ] Move layout components to `components/layout/`
- [ ] Test that shared infrastructure works

### Phase 2.5: Services Setup

- [ ] Create `services/` directory structure
- [ ] Move AI-related code from `lib/ai/` to `services/ai/`
- [ ] Move geocoding utilities to `services/geocoding/`
- [ ] Move image processing utilities to `services/image-processing/`
- [ ] Move payment processing utilities to `services/payment-processing/`
- [ ] Create service-specific components, hooks, and types for each service
- [ ] Update all imports to use new service paths
- [ ] Test all external API integrations

### Phase 3: Authentication Feature

- [ ] Create `features/auth/` structure
- [ ] Move auth-related schemas (`users.schema.ts`, `sessions.schema.ts`)
- [ ] Extract auth DAL methods from `user.dal.ts` → `features/auth/auth.dal.ts`
- [ ] Move auth-related actions (`update-user-profile.ts`)
- [ ] Move auth-related components (`nav-user.tsx`, `user-card.tsx`)
- [ ] Create `features/auth/auth.constants.ts`
- [ ] Create `features/auth/auth.utils.ts`
- [ ] Move auth seed data to `features/auth/auth.seed.ts`
- [ ] Update all imports
- [ ] Test auth functionality

### Phase 4: Tools Feature

- [ ] Create `features/tools/` structure
- [ ] Move tool schemas (`tools.schema.ts`)
- [ ] Move tool DAL methods from `tool.dal.ts` → `features/tools/tools.dal.ts`
- [ ] Move tool actions (`create-tool.ts`, `update-tool.ts`, `delete-tool.ts`, `update-tool-status.ts`, `analyze-tool-image.ts`)
- [ ] Move tool-related components from `dashboard/` and `tools/` pages
- [ ] Move tool form schemas
- [ ] Create `features/tools/tools.constants.ts`
- [ ] Create `features/tools/tools.utils.ts`
- [ ] Move tool seed data to `features/tools/tools.seed.ts`
- [ ] Update all imports
- [ ] Test tool functionality

### Phase 5: Rentals Feature

- [ ] Create `features/rentals/` structure
- [ ] Move rental schemas (`rentals.schema.ts`)
- [ ] Move rental DAL methods from `rentals.dal.ts` → `features/rentals/rentals.dal.ts`
- [ ] Move rental actions (`create-rental-request.ts`, `approve-rental-request.ts`, `decline-rental-request.ts`, `cancel-rental-request.ts`)
- [ ] Move rental-related components
- [ ] Create `features/rentals/rentals.constants.ts`
- [ ] Create `features/rentals/rentals.utils.ts`
- [ ] Move rental seed data to `features/rentals/rentals.seed.ts`
- [ ] Update all imports
- [ ] Test rental functionality

### Phase 6: Messaging Feature

- [ ] Create `features/messaging/` structure
- [ ] Move message schemas (`messages.schema.ts`)
- [ ] Move message DAL methods from `messages.dal.ts` → `features/messaging/messaging.dal.ts`
- [ ] Move message actions (`send-message.ts`)
- [ ] Move messaging components from `mailbox/`
- [ ] Create `features/messaging/messaging.constants.ts`
- [ ] Create `features/messaging/messaging.utils.ts`
- [ ] Move message seed data to `features/messaging/messaging.seed.ts`
- [ ] Update all imports
- [ ] Test messaging functionality

### Phase 7: Reviews Feature

- [ ] Create `features/reviews/` structure
- [ ] Move review DAL methods from `review.dal.ts` → `features/reviews/reviews.dal.ts`
- [ ] Move review-related components
- [ ] Create `features/reviews/reviews.constants.ts`
- [ ] Create `features/reviews/reviews.utils.ts`
- [ ] Move review seed data to `features/reviews/reviews.seed.ts`
- [ ] Update all imports
- [ ] Test review functionality

### Phase 8: Payments Feature

- [ ] Create `features/payments/` structure
- [ ] Move payment schemas (`payments.schema.ts`)
- [ ] Move payment-related components
- [ ] Create `features/payments/payments.constants.ts`
- [ ] Create `features/payments/payments.utils.ts`
- [ ] Move payment seed data to `features/payments/payments.seed.ts`
- [ ] Update all imports
- [ ] Test payment functionality

### Phase 9: Notifications Feature

- [ ] Create `features/notifications/` structure
- [ ] Move notification schemas (`notifications.schema.ts`)
- [ ] Move notification-related components
- [ ] Create `features/notifications/notifications.constants.ts`
- [ ] Create `features/notifications/notifications.utils.ts`
- [ ] Move notification seed data to `features/notifications/notifications.seed.ts`
- [ ] Update all imports
- [ ] Test notification functionality

### Phase 10: Users Feature

- [ ] Create `features/users/` structure
- [ ] Move user-related components and logic
- [ ] Create `features/users/users.constants.ts`
- [ ] Create `features/users/users.utils.ts`
- [ ] Move user seed data to `features/users/users.seed.ts`
- [ ] Update all imports
- [ ] Test user functionality

### Phase 11: Explore Feature

- [ ] Create `features/explore/` structure
- [ ] Move explore-related components
- [ ] Create `features/explore/explore.constants.ts`
- [ ] Create `features/explore/explore.utils.ts`
- [ ] Update all imports
- [ ] Test explore functionality

### Phase 12: Dashboard Feature

- [ ] Create `features/dashboard/` structure
- [ ] Move dashboard-related components
- [ ] Create `features/dashboard/dashboard.constants.ts`
- [ ] Create `features/dashboard/dashboard.utils.ts`
- [ ] Update all imports
- [ ] Test dashboard functionality

### Phase 13: Cleanup & Testing

- [ ] Remove empty directories
- [ ] Update all remaining import paths
- [ ] Run full test suite
- [ ] Fix any build errors
- [ ] Update documentation
- [ ] Verify all features work correctly

## Key Considerations

1. **Cross-Feature Dependencies**: Some features will have dependencies on others (e.g., rentals depend on tools and users). We'll need to handle these carefully.

2. **Shared Types**: Common types used across features should go in `lib/types/`.

3. **Database Schemas**: Some schemas might be used by multiple features. We'll need to decide whether to duplicate them or keep them in shared.

4. **Testing Strategy**: Each phase should include testing to ensure nothing breaks.

5. **Import Paths**: All import paths will need to be updated throughout the refactor.

6. **External Services**: All external API interactions should be centralized in the `services/` directory to avoid littering API code throughout the application.

7. **Service Organization**: Each service can have its own components, hooks, and types specific to that external API integration.

## Progress Tracking

- **Current Phase**: Phase 2 - Shared Infrastructure Setup
- **Status**: Not started
- **Next Action**: Begin moving shared infrastructure files

## Notes

- Each feature should be completely self-contained with its own DAL, constants, utils, and seed files
- Shared code stays at the top level under `src/`
- The app folder should only contain routing and minimal rendering logic
- All business logic should move to feature folders
- External API interactions should be centralized in the `services/` directory
- Each service can have its own components, hooks, and types specific to that external API
