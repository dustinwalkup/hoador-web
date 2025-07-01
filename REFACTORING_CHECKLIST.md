# 🏗️ Codebase Refactoring Checklist

## Overview

This checklist tracks the implementation of 5 major architectural improvements.

**Current State**: Well-structured Next.js app with good separation of concerns, but needs architectural refinements for scalability and maintainability.

**Target State**: Enterprise-grade architecture with clear domain boundaries, proper abstraction layers, and feature-based organization.

---

## ✅ 1. Fix Constants Organization

### Current Issues

- Constants files have `.tsx` extension but contain only data (no JSX needed)
- JSX elements embedded directly in constants
- Scattered across multiple files

### Tasks

- [x] **Rename constants files** from `.tsx` to `.ts`

  - [x] `src/lib/constants/dashboard.tsx` → `dashboard.ts`
  - [x] `src/lib/constants/garage.tsx` → `garage.ts`
  - [x] `src/lib/constants/home.tsx` → `home.ts`
  - [x] `src/lib/constants/navbar.ts` (already correct)
  - [x] `src/lib/constants/profile.ts` (already correct)

- [x] **Refactor JSX in constants** to use string references

  - [x] Replace `<PlusCircle className="..." />` with `iconName: "PlusCircle"`
  - [x] Create icon mapping in components
  - [x] Update all button definitions in constants

- [x] **Update imports** across the codebase
  - [x] Find all imports of renamed files
  - [x] Update import statements
  - [x] Test that components still render correctly

### Files to Modify

```
src/lib/constants/
├── dashboard.tsx → dashboard.ts
├── garage.tsx → garage.ts
├── home.tsx → home.ts
├── navbar.ts (no change needed)
└── profile.ts (no change needed)
```

### Example Transformation

```typescript
// Before (dashboard.tsx)
buttons: [
  {
    id: 1,
    label: "Add New Listing",
    icon: <PlusCircle className="mr-1 h-3.5 w-3.5" />,
    buttonVariant: "default",
  },
]

// After (dashboard.ts)
buttons: [
  {
    id: 1,
    label: "Add New Listing",
    iconName: "PlusCircle",
    buttonVariant: "default",
  },
]
```

---

## ✅ 2. Implement Infrastructure Layer

### Purpose

Handle external dependencies and technical concerns (email, storage, payments, logging, database) that business logic shouldn't know about.

### Tasks

- [ ] **Create infrastructure directory structure**

  ```
  src/infrastructure/
  ├── storage/
  ├── email/
  ├── payments/
  ├── logging/
  ├── database/
  └── external-apis/
  ```

- [ ] **Migrate Data Access Layer (DAL)**

  - [ ] Move `src/lib/dal/` to `src/infrastructure/database/dal/`
  - [ ] Update import paths across the codebase
  - [ ] Ensure DAL remains focused on raw database operations
  - [ ] Keep base DAL class and error handling

- [ ] **Implement File Storage Service**

  - [ ] Create `src/infrastructure/storage/file-storage.ts`
  - [ ] Define `FileStorageService` interface
  - [ ] Implement `VercelBlobStorage` class
  - [ ] Move existing blob upload logic from actions

- [ ] **Implement Email Service**

  - [ ] Create `src/infrastructure/email/email-service.ts`
  - [ ] Define `EmailService` interface
  - [ ] Implement `SendGridEmailService` class
  - [ ] Add email templates for common scenarios

- [ ] **Implement Payment Service**

  - [ ] Create `src/infrastructure/payments/payment-service.ts`
  - [ ] Define `PaymentService` interface
  - [ ] Implement `StripePaymentService` class
  - [ ] Add payment processing logic

- [ ] **Implement Logging Service**

  - [ ] Create `src/infrastructure/logging/logger.ts`
  - [ ] Define `Logger` interface
  - [ ] Implement `WinstonLogger` class
  - [ ] Replace console.log statements

- [ ] **Create service factory/DI container**
  - [ ] Create `src/infrastructure/index.ts`
  - [ ] Export configured service instances
  - [ ] Add environment-based configuration

### Files to Create

```
src/infrastructure/
├── index.ts
├── storage/
│   └── file-storage.ts
├── email/
│   └── email-service.ts
├── payments/
│   └── payment-service.ts
├── logging/
│   └── logger.ts
├── database/
│   ├── dal/
│   │   ├── base.ts
│   │   ├── tool.dal.ts
│   │   ├── user.dal.ts
│   │   ├── rental.dal.ts
│   │   └── review.dal.ts
│   └── connection.ts
└── external-apis/
    └── maps-service.ts
```

### Integration Points

- Update `src/lib/actions/create-tool.ts` to use infrastructure services
- Update `src/lib/actions/update-user-profile.ts` to use email service
- Replace direct blob upload calls with file storage service

---

## ✅ 3. Implement Service Layer (Simplified)

### Purpose

Contain business logic that needs to be shared between server actions and API routes (for mobile), while keeping server actions simple.

### Strategy

- **Keep server actions simple** - they should be thin wrappers
- **Extract only shared logic** - business rules that both web and mobile need
- **Don't over-engineer** - only add services when you need mobile API

### Tasks

- [ ] **Create service directory structure (Only when needed)**

  ```
  src/lib/services/ (Simple approach)
  ├── tool-service.ts (only if needed)
  ├── user-service.ts (only if needed)
  └── rental-service.ts (only if needed)
  ```

- [ ] **Implement Tool Service (Only if needed for mobile)**

  - [ ] Create `src/lib/services/tool-service.ts` (only when needed)
  - [ ] Extract ONLY business logic that mobile will need
  - [ ] Keep validation and simple operations in server actions
  - [ ] Focus on complex workflows (create tool → upload images → notifications)

- [ ] **Implement User Service (Only if needed for mobile)**

  - [ ] Create `src/lib/services/user-service.ts` (only when needed)
  - [ ] Extract user registration/verification workflows
  - [ ] Keep simple profile updates in server actions

- [ ] **Implement Rental Service (Only if needed for mobile)**

  - [ ] Create `src/lib/services/rental-service.ts` (only when needed)
  - [ ] Extract rental approval workflows
  - [ ] Keep simple status updates in server actions

- [ ] **Update Server Actions (Minimal changes)**
  - [ ] Keep server actions simple - they can stay mostly as-is
  - [ ] Only refactor if you need mobile API sharing
  - [ ] Server actions can still do validation and simple operations

### Files to Create/Modify

```
src/lib/services/ (Simple approach)
├── tool-service.ts (only if needed)
├── user-service.ts (only if needed)
└── rental-service.ts (only if needed)

src/lib/actions/ (keep mostly unchanged)
├── create-tool.ts
├── update-tool.ts
├── update-user-profile.ts
└── delete-tool.ts
```

### When to Add Services

**Add services when:**

- You're building mobile API endpoints
- You have complex workflows that need testing
- You need to share logic between multiple server actions

**Keep it simple when:**

- You only have web forms
- Server actions are straightforward
- You don't need mobile API yet

### Server Action Examples

```typescript
// Simple server action (keep as-is)
// src/lib/actions/update-user-profile.ts
"use server";
export async function updateUserProfile(data: UpdateProfileData) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Unauthorized");

  // Simple validation and update - no service needed
  return userDAL.updateUser(userId, data);
}

// Complex server action (might need service)
// src/lib/actions/create-tool.ts
("use server");
export async function createTool(formData: CreateToolFormData) {
  // If this gets complex or mobile needs it, extract to service
  return toolService.createTool(formData);
}
```

---

## ✅ 4. Implement Repository Pattern

### Purpose

Abstract data access with domain-focused interfaces, caching, and complex query composition. Repositories use DAL for raw database operations.

### Architecture Flow

```
Infrastructure Layer (DAL) → Feature Layer (Repository) → Feature Layer (Service) → Next.js (API/Components)
```

### Tasks

- [ ] **Create repository directory structure**

  ```
  src/features/*/repositories/
  ├── tool-repository.ts
  ├── user-repository.ts
  ├── rental-repository.ts
  └── review-repository.ts
  ```

- [ ] **Implement Tool Repository**

  - [ ] Create `src/features/tools/repositories/tool-repository.ts`
  - [ ] Define `ToolRepository` interface
  - [ ] Use `ToolDAL` from infrastructure for raw database operations
  - [ ] Implement caching for tool lookups
  - [ ] Add complex queries (similar tools, area search)
  - [ ] Add favorites management

- [ ] **Implement User Repository**

  - [ ] Create `src/features/users/repositories/user-repository.ts`
  - [ ] Define `UserRepository` interface
  - [ ] Use `UserDAL` from infrastructure for raw database operations
  - [ ] Add user stats aggregation
  - [ ] Add rental history queries
  - [ ] Add favorites queries

- [ ] **Implement Rental Repository**

  - [ ] Create `src/features/rentals/repositories/rental-repository.ts`
  - [ ] Define `RentalRepository` interface
  - [ ] Use `RentalDAL` from infrastructure for raw database operations
  - [ ] Add rental status queries
  - [ ] Add date range queries
  - [ ] Add user rental history

- [ ] **Add Caching Layer**

  - [ ] Create `src/infrastructure/caching/cache-service.ts`
  - [ ] Implement Redis or in-memory caching
  - [ ] Add cache invalidation strategies
  - [ ] Add cache warming for popular queries

- [ ] **Update Services to Use Repositories**
  - [ ] Update `ToolService` to use `ToolRepository`
  - [ ] Update `UserService` to use `UserRepository`
  - [ ] Update `RentalService` to use `RentalRepository`

### Files to Create

```
src/features/tools/repositories/
├── tool-repository.ts

src/features/users/repositories/
├── user-repository.ts

src/features/rentals/repositories/
├── rental-repository.ts

src/infrastructure/caching/
└── cache-service.ts
```

### Repository vs DAL Responsibilities

**DAL (Infrastructure Layer):**

- Raw database operations
- SQL queries and connection management
- Database-specific error handling
- Transaction management

**Repository (Feature Layer):**

- Domain-focused data access
- Caching and optimization
- Complex query composition
- Business-specific data transformations

### Repository Features

- **Caching**: Redis or in-memory cache for frequently accessed data
- **Complex Queries**: Geospatial search, similarity matching, aggregation
- **Optimization**: Lazy loading, pagination, selective field loading
- **Abstraction**: Hide database details from business logic

---

## ✅ 5. Implement Feature-Based Architecture (Optional - Only When Needed)

### Purpose

Organize business logic by domains while maintaining Next.js conventions for optimal web + mobile API sharing.

### Strategy

- **Keep Next.js structure** for routes and web-specific concerns
- **Feature-based organization** for shared business logic (services, repositories, schemas)
- **Shared types and validation** across web and mobile platforms
- **Only implement when you need mobile API** - this is optional for web-only apps

### Tasks

- [ ] **Create hybrid directory structure**

  ```
  src/
  ├── app/ (Keep Next.js structure)
  │   ├── (auth)/
  │   ├── dashboard/
  │   └── api/ (Mobile API endpoints)
  ├── features/ (Shared business logic)
  │   ├── tools/
  │   ├── users/
  │   ├── rentals/
  │   └── shared/
  ├── infrastructure/ (Technical concerns)
  └── db/ (Database layer)
  ```

- [ ] **Migrate Tools Feature (Shared Logic)**

  - [ ] Create `src/features/tools/` structure
  - [ ] Move tool services from `src/lib/services/`
  - [ ] Move tool repositories from `src/lib/repositories/`
  - [ ] Move tool schemas from `src/lib/form-schemas/`
  - [ ] Move tool types to `src/features/tools/types/`
  - [ ] Keep tool components in `src/components/` (web-specific)

- [ ] **Migrate Users Feature (Shared Logic)**

  - [ ] Create `src/features/users/` structure
  - [ ] Move user services and repositories
  - [ ] Move user schemas and types
  - [ ] Keep user components in `src/components/` (web-specific)

- [ ] **Migrate Rentals Feature (Shared Logic)**

  - [ ] Create `src/features/rentals/` structure
  - [ ] Move rental services and repositories
  - [ ] Move rental schemas and types
  - [ ] Keep rental components in `src/components/` (web-specific)

- [ ] **Create Shared Module**

  - [ ] Move common types to `src/features/shared/types/`
  - [ ] Move common utilities to `src/features/shared/utils/`
  - [ ] Keep UI components in `src/components/ui/` (web-specific)
  - [ ] Keep common hooks in `src/hooks/` (web-specific)

- [ ] **Update API Routes for Mobile**

  - [ ] Ensure API routes use feature services
  - [ ] Add mobile-specific API endpoints
  - [ ] Implement consistent response formats
  - [ ] Add mobile authentication endpoints

- [ ] **Update Import Paths**
  - [ ] Update service imports to use feature paths
  - [ ] Update repository imports to use feature paths
  - [ ] Update schema imports to use feature paths
  - [ ] Test web functionality
  - [ ] Test API endpoints

### Final Structure (Hybrid Approach)

```
src/
├── app/ (Next.js routes - unchanged)
│   ├── (auth)/
│   ├── dashboard/
│   └── api/ (Mobile API)
├── features/ (Shared business logic)
│   ├── tools/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── types/
│   ├── users/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── types/
│   ├── rentals/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── types/
│   └── shared/
│       ├── types/
│       └── utils/
├── components/ (Web UI - unchanged)
│   ├── ui/
│   └── dashboard/
├── hooks/ (Web-specific - unchanged)
├── infrastructure/ (Technical concerns)
└── db/ (Database layer)
```

### Benefits for Mobile API

- **Shared Business Logic**: Mobile app uses same services
- **Consistent Validation**: Same Zod schemas for web and mobile
- **Type Safety**: Shared TypeScript types across platforms
- **API Consistency**: Same data models and responses
- **Next.js Compatibility**: Maintains Next.js conventions for web

---

## 📊 Progress Tracking

### Phase 1: Foundation (Constants + Infrastructure)

- [x] **Constants Organization** - 3/3 tasks complete
- [ ] **Infrastructure Layer** - 0/6 tasks complete

### Phase 2: Business Logic (Services + Repositories)

- [ ] **Service Layer** - 0/4 tasks complete
- [ ] **Repository Pattern** - 0/5 tasks complete

### Phase 3: Organization (Feature-Based)

- [ ] **Feature-Based Development** - 0/5 tasks complete

### Overall Progress

- **Total Tasks**: 23
- **Completed**: 3
- **Remaining**: 20
- **Progress**: 13%

---

## 🎯 Success Criteria

### Code Quality Metrics

- [ ] **File Size**: No file > 300 lines
- [ ] **Import Organization**: Clean, logical import paths
- [ ] **Type Safety**: 100% TypeScript coverage
- [ ] **Error Handling**: Consistent error patterns
- [ ] **Testing**: Unit tests for all services and repositories

### Architecture Goals

- [ ] **Separation of Concerns**: Clear boundaries between layers
- [ ] **Dependency Inversion**: High-level modules don't depend on low-level modules
- [ ] **Single Responsibility**: Each class/module has one reason to change
- [ ] **Open/Closed Principle**: Open for extension, closed for modification
- [ ] **Feature Independence**: Features can be developed/deployed independently

### Performance Goals

- [ ] **Caching**: Frequently accessed data is cached
- [ ] **Lazy Loading**: Components and data loaded on demand
- [ ] **Bundle Size**: No significant increase in bundle size
- [ ] **Query Optimization**: Database queries are optimized

---

## 🚀 Next Steps

1. **Start with Phase 1**: Constants organization is the easiest win
2. **Infrastructure layer**: Provides foundation for better services
3. **Service layer**: Moves business logic out of actions
4. **Repository pattern**: Improves data access abstraction
5. **Feature-based organization**: Final step for scalability

Each phase builds on the previous one, so we'll tackle them in order for maximum effectiveness.

---

## 📝 Notes

- **Risk**: Breaking changes during refactoring
- **Mitigation**: Implement incrementally with thorough testing
- **Timeline**: Estimate 2-3 weeks for complete refactoring
- **Testing**: Each phase should be fully tested before moving to next
- **Documentation**: Update README and documentation as we go

---

_Last Updated: [Current Date]_
_Status: Planning Phase_
