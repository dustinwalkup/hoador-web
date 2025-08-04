# Feature-Based Folder Structure Refactor Plan

## Overview

Refactor the Next.js project to use a feature-based folder structure as described in "This Folder Structure Makes Me 100% More Productive" by Web Dev Simplified.

## Goals

- Group all code by feature, not by technology
- Each feature should have its own folder under `src/features/`
- Inside each feature folder, include subfolders for components, server (API, actions, logic), and other relevant code
- Keep all Drizzle database files (schemas, seeds, db.ts) in `src/db/` directory
- Centralize all third-party service integrations in `src/services/`
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
│   │   ├── dal/
│   │   │   └── auth.dal.ts
│   │   ├── data/
│   │   │   └── auth.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── tools/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── tools.dal.ts
│   │   ├── data/
│   │   │   └── tools.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── rentals/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── rentals.dal.ts
│   │   ├── data/
│   │   │   └── rentals.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── messaging/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── messaging.dal.ts
│   │   ├── data/
│   │   │   └── messaging.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── reviews/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── reviews.dal.ts
│   │   ├── data/
│   │   │   └── reviews.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── payments/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── payments.dal.ts
│   │   ├── data/
│   │   │   └── payments.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── notifications/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── notifications.dal.ts
│   │   ├── data/
│   │   │   └── notifications.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── users/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── dal/
│   │   │   └── users.dal.ts
│   │   ├── data/
│   │   │   └── users.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   ├── explore/
│   │   ├── components/
│   │   ├── server/
│   │   │   ├── actions/
│   │   │   └── api/
│   │   ├── data/
│   │   │   └── explore.constants.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── types/
│   └── dashboard/
│       ├── components/
│       ├── server/
│       │   ├── actions/
│       │   └── api/
│       ├── data/
│       │   └── dashboard.constants.ts
│       ├── lib/
│       │   └── utils.ts
│       └── types/
├── services/
│   ├── clerk/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── inngest/
│   │   ├── resend/
│   │   └── uploadthing/
│   ├── stripe/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── webhooks/
│   │   └── types/
│   ├── openai/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── types/
│   ├── resend/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── templates/
│   │   └── types/
│   ├── uploadthing/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── types/
│   ├── inngest/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── functions/
│   │   └── types/
│   ├── geocoding/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── types/
│   └── image-processing/
│       ├── components/
│       ├── lib/
│       ├── hooks/
│       └── types/
├── db/
│   ├── schemas/
│   │   ├── _enums.ts
│   │   ├── collections.schema.ts
│   │   ├── index.ts
│   │   ├── messages.schema.ts
│   │   ├── notifications.schema.ts
│   │   ├── payments.schema.ts
│   │   ├── rentals.schema.ts
│   │   ├── sessions.schema.ts
│   │   ├── tools.schema.ts
│   │   └── users.schema.ts
│   ├── seeds/
│   │   ├── collections.seed.ts
│   │   ├── messages.seed.ts
│   │   ├── notifications.seed.ts
│   │   ├── payments.seed.ts
│   │   ├── rentals.seed.ts
│   │   ├── seed.ts
│   │   ├── tools.seed.ts
│   │   └── users.seed.ts
│   └── db.ts
├── components/
│   ├── ui/
│   └── layout/
├── lib/
│   ├── auth/
│   ├── utils/
│   ├── data/
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

## Third-Party Services Identified

1. **Clerk** - Authentication and user management
2. **Stripe** - Payment processing
3. **OpenAI** - AI/ML services
4. **Resend** - Email services
5. **UploadThing** - File uploads
6. **Inngest** - Background jobs and workflows
7. **Geocoding** - Location services
8. **Image Processing** - Image manipulation and optimization

## Refactor Checklist (One Feature at a Time)

### Phase 1: Planning & Analysis ✅

- [x] Analyze current codebase structure
- [x] Identify features and dependencies
- [x] Create refactor plan
- [x] Document current structure

### Phase 2: Shared Infrastructure Setup ✅

- [x] Move authentication utilities to `lib/auth/`
- [x] Move global utilities to `lib/utils/`
- [x] Move global constants to `lib/data/`
- [x] Move global hooks to `hooks/`
- [x] Move global types to `lib/types/`
- [x] Test that there are no errors

### Phase 2.5: Services Setup ✅

- [x] Create `services/` directory structure
- [x] Move OpenAI-related code to `services/openai/`
- [x] Move Vercel blob-related code to `services/vercel-blob/`
- [x] Move geocoding utilities to `services/geocoding/`
- [x] Create service-specific components, hooks, and types for each service
- [x] Update all imports to use new service paths
- [x] Test all external API integrations

### Phase 3: Authentication Feature

- [ ] Create `features/auth/` structure
- [ ] Extract auth DAL methods from `user.dal.ts` → `features/auth/dal/auth.dal.ts`
- [ ] Move auth-related actions (`update-user-profile.ts`)
- [ ] Move auth-related components (`nav-user.tsx`, `user-card.tsx`)
- [ ] Create `features/auth/data/auth.constants.ts`
- [ ] Create `features/auth/lib/utils.ts`
- [ ] Update all imports
- [ ] Test auth functionality

### Phase 4: Tools Feature

- [ ] Create `features/tools/` structure
- [ ] Move tool DAL methods from `tool.dal.ts` → `features/tools/dal/tools.dal.ts`
- [ ] Move tool actions (`create-tool.ts`, `update-tool.ts`, `delete-tool.ts`, `update-tool-status.ts`, `analyze-tool-image.ts`)
- [ ] Move tool-related components from `dashboard/` and `tools/` pages
- [ ] Move tool form schemas
- [ ] Create `features/tools/data/tools.constants.ts`
- [ ] Create `features/tools/lib/utils.ts`
- [ ] Update all imports
- [ ] Test tool functionality

### Phase 5: Rentals Feature

- [ ] Create `features/rentals/` structure
- [ ] Move rental DAL methods from `rentals.dal.ts` → `features/rentals/dal/rentals.dal.ts`
- [ ] Move rental actions (`create-rental-request.ts`, `approve-rental-request.ts`, `decline-rental-request.ts`, `cancel-rental-request.ts`)
- [ ] Move rental-related components
- [ ] Create `features/rentals/data/rentals.constants.ts`
- [ ] Create `features/rentals/lib/utils.ts`
- [ ] Update all imports
- [ ] Test rental functionality

### Phase 6: Messaging Feature

- [ ] Create `features/messaging/` structure
- [ ] Move message DAL methods from `messages.dal.ts` → `features/messaging/dal/messaging.dal.ts`
- [ ] Move message actions (`send-message.ts`)
- [ ] Move messaging components from `mailbox/`
- [ ] Create `features/messaging/data/messaging.constants.ts`
- [ ] Create `features/messaging/lib/utils.ts`
- [ ] Update all imports
- [ ] Test messaging functionality

### Phase 7: Reviews Feature

- [ ] Create `features/reviews/` structure
- [ ] Move review DAL methods from `review.dal.ts` → `features/reviews/dal/reviews.dal.ts`
- [ ] Move review-related components
- [ ] Create `features/reviews/data/reviews.constants.ts`
- [ ] Create `features/reviews/lib/utils.ts`
- [ ] Update all imports
- [ ] Test review functionality

### Phase 8: Payments Feature

- [ ] Create `features/payments/` structure
- [ ] Move payment-related components
- [ ] Create `features/payments/data/payments.constants.ts`
- [ ] Create `features/payments/lib/utils.ts`
- [ ] Update all imports
- [ ] Test payment functionality

### Phase 9: Notifications Feature

- [ ] Create `features/notifications/` structure
- [ ] Move notification-related components
- [ ] Create `features/notifications/data/notifications.constants.ts`
- [ ] Create `features/notifications/lib/utils.ts`
- [ ] Update all imports
- [ ] Test notification functionality

### Phase 10: Users Feature

- [ ] Create `features/users/` structure
- [ ] Move user-related components and logic
- [ ] Create `features/users/data/users.constants.ts`
- [ ] Create `features/users/lib/utils.ts`
- [ ] Update all imports
- [ ] Test user functionality

### Phase 11: Explore Feature

- [ ] Create `features/explore/` structure
- [ ] Move explore-related components
- [ ] Create `features/explore/data/explore.constants.ts`
- [ ] Create `features/explore/lib/utils.ts`
- [ ] Update all imports
- [ ] Test explore functionality

### Phase 12: Dashboard Feature

- [ ] Create `features/dashboard/` structure
- [ ] Move dashboard-related components
- [ ] Create `features/dashboard/data/dashboard.constants.ts`
- [ ] Create `features/dashboard/lib/utils.ts`
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

3. **Database Schemas**: All Drizzle schemas and seed files remain in `src/db/` directory to maintain database integrity and avoid splitting related database code.

4. **Third-Party Services**: All external API integrations are centralized in `src/services/` with each service having its own components, hooks, and types.

5. **Testing Strategy**: Each phase should include testing to ensure nothing breaks.

6. **Import Paths**: All import paths will need to be updated throughout the refactor.

7. **Service Organization**: Each service can have its own components, hooks, and types specific to that external API integration.

## Progress Tracking

- **Current Phase**: Phase 2.5 - Services Setup
- **Status**: ✅ Complete
- **Next Action**: Begin Phase 3 - Authentication Feature

## Notes

- Each feature should be completely self-contained with its own DAL, constants, and utils files
- DAL files are organized in `features/[feature-name]/dal/` directories
- Constants files are organized in `features/[feature-name]/data/` directories
- Utils files are organized in `features/[feature-name]/lib/utils.ts`
- All Drizzle database files (schemas, seeds, db.ts) remain in `src/db/` directory
- All third-party service integrations are centralized in `src/services/` directory
- Shared code stays at the top level under `src/`
- The app folder should only contain routing and minimal rendering logic
- All business logic should move to feature folders
- Each service can have its own components, hooks, and types specific to that external API
- Services can have subdirectories for different integrations (e.g., Clerk with Inngest, Resend, UploadThing)
