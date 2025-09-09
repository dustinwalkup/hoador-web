# TanStack Query Implementation for Rental Routes

## Overview

Transform rental routes from server-side rendering to client-side caching using TanStack Query, following the same pattern as the explore page for instant navigation between rental tabs.

## Implementation Checklist

### Phase 1: API Routes Foundation ✅

- [x] Create `/src/app/api/rentals/renting/requests/route.ts`
- [x] Create `/src/app/api/rentals/renting/active/route.ts`
- [x] Create `/src/app/api/rentals/renting/completed/route.ts`
- [x] Create `/src/app/api/rentals/lending/incoming/route.ts`
- [x] Create `/src/app/api/rentals/lending/active/route.ts`
- [x] Create `/src/app/api/rentals/lending/completed/route.ts`
- [x] Create `/src/app/api/rentals/[id]/route.ts`
- [ ] Test all API endpoints manually
- [ ] Verify API responses match DAL return types

### Phase 2: TanStack Query Hooks

- [ ] Create `/src/features/rentals/hooks/use-rentals.ts`
- [ ] Implement `useRentingRequests()` hook
- [ ] Implement `useRentingActive()` hook
- [ ] Implement `useRentingCompleted()` hook
- [ ] Implement `useLendingRequests()` hook
- [ ] Implement `useRentalDetails()` hook
- [ ] Implement `usePrefetchRental()` hook
- [ ] Define consistent query keys structure
- [ ] Set appropriate stale times for different data types
- [ ] Test hooks in isolation

### Phase 3: Convert Pages to Client Components

- [ ] Create `/src/app/dashboard/(rentals)/_components/rentals-client.tsx`
- [ ] Create loading skeleton component
- [ ] Create error handling component
- [ ] Update `/src/app/dashboard/(rentals)/[type]/[status]/page.tsx`
- [ ] Update `/src/app/dashboard/(rentals)/rental/[id]/page.tsx`
- [ ] Test tab switching performance
- [ ] Verify data consistency between old and new implementations
- [ ] Remove old server-side data fetching code

### Phase 4: Performance & Polish

- [ ] Add prefetching on hover for rental cards
- [ ] Implement proper loading states for all components
- [ ] Add error boundaries and retry mechanisms
- [ ] Fine-tune cache stale times based on usage
- [ ] Add background refetching for critical data
- [ ] Implement cache invalidation strategies
- [ ] Performance testing and optimization

### Phase 5: Optimistic Updates (Future)

- [ ] Identify actions that need optimistic updates
- [ ] Implement optimistic updates for approve/reject actions
- [ ] Add proper error handling for failed optimistic updates
- [ ] Test optimistic update rollback scenarios

## Performance Goals

- **Tab Switching**: 95% faster (instant cached data)
- **First Load**: Same speed (initial API call)
- **Status Updates**: 90% faster with optimistic updates
- **Navigation**: 90% faster (no page reloads)

## Current Status

- **Phase 1**: ✅ Complete
- **Phase 2**: Not Started
- **Phase 3**: Not Started
- **Phase 4**: Not Started
- **Phase 5**: Not Started

## Notes

- Follow the same patterns used in explore page (`src/features/listings/hooks/use-listings.ts`)
- Maintain compatibility with existing DAL methods
- Use `tryCatch` from `@walkup/walkup-utils` for consistent error handling
- Keep query keys consistent and hierarchical for easy invalidation
