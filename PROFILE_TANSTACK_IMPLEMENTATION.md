# TanStack Query Implementation for Profile Routes

## Overview

Transform profile routes from server-side rendering to client-side caching using TanStack Query, following the same pattern as the rental and garage routes for instant navigation between profile tabs and real-time data updates.

## Current State Analysis

### **Current Profile System:**

- ❌ **Server-side rendering on every tab change** - Full page reload for profile/reviews/verification/preferences/billing/security tabs
- ❌ **No caching** - Same user data fetched repeatedly when switching tabs
- ❌ **Multiple Promise.all calls** on each page load
- ❌ **Direct DAL calls in RSC** - `await reviewDAL.getSummaryForUser()`, `await rentalDAL.countBorrowedListings()` on every route
- ❌ **URL navigation** but with full page reloads

### **Current DAL Methods:**

- `reviewDAL.getSummaryForUser(userId)`
- `reviewDAL.getRatingDistribution(userId)`
- `reviewDAL.getRecentReviews(userId, options)`
- `reviewDAL.getReviewsCount(userId)`
- `rentalDAL.countBorrowedListings(userId)`
- `rentalDAL.countSharedListings(userId)`
- `getCurrentUser()` (authentication)

### **Current Route Structure:**

- `/dashboard/profile` - Main profile page with overview
- `/dashboard/profile/reviews` - Reviews with pagination and sorting
- `/dashboard/profile/billing` - Billing and payment methods

## Implementation Checklist

### Phase 1: API Routes Foundation

- [ ] Create `/src/app/api/profile/overview/route.ts`
- [ ] Create `/src/app/api/profile/reviews/route.ts`
- [ ] Create `/src/app/api/profile/billing/route.ts`
- [ ] Test all API endpoints manually
- [ ] Verify API responses match DAL return types

### Phase 2: TanStack Query Hooks

- [ ] Create `/src/features/users/hooks/use-profile.ts`
- [ ] Implement `useProfileOverview()` hook
- [ ] Implement `useUserReviews(pagination, sorting)` hook
- [ ] Implement `useReviewSummary()` hook
- [ ] Implement `useRatingDistribution()` hook
- [ ] Implement `useBillingInfo()` hook
- [ ] Define consistent query keys structure
- [ ] Set appropriate stale times for different data types
- [ ] Test hooks in isolation

### Phase 3: Convert Pages to Client Components

- [ ] Create `/src/app/dashboard/profile/_components/profile-client.tsx`
- [ ] Create loading skeleton components for each tab
- [ ] Create error handling components
- [ ] Convert profile overview to use hooks
- [ ] Convert reviews page to use hooks with pagination
- [ ] Convert billing page to use hooks
- [ ] Update `/src/app/dashboard/profile/layout.tsx`
- [ ] Implement instant tab switching with cached data
- [ ] Test tab switching performance
- [ ] Verify data consistency between old and new implementations
- [ ] Remove old server-side data fetching code

### Phase 4: Performance & Polish

- [ ] Add prefetching for likely next actions
- [ ] Implement proper loading states for all components
- [ ] Add error boundaries and retry mechanisms
- [ ] Fine-tune cache stale times based on usage
- [ ] Add background refetching for critical data
- [ ] Implement cache invalidation strategies
- [ ] Performance testing and optimization

### Phase 5: Advanced Features (Future)

- [ ] Add optimistic updates for profile changes
- [ ] Add infinite scroll for reviews (if needed)
- [ ] Implement advanced filtering for reviews

## Performance Goals

- **Tab Switching**: 95% faster (instant cached data)
- **Profile Updates**: 90% faster with optimistic updates
- **Reviews Pagination**: 85% faster with cached pages
- **First Load**: Same speed (initial API call)

## API Routes Structure

```
src/app/api/profile/
├── overview/route.ts       # GET /api/profile/overview (user + stats)
├── reviews/route.ts        # GET /api/profile/reviews?page=&limit=&sortBy=&sortOrder=
└── billing/route.ts        # GET /api/profile/billing
```

## TanStack Query Hooks Structure

```typescript
// Query keys for consistent caching
export const profileKeys = {
  all: ["profile"] as const,
  overview: () => [...profileKeys.all, "overview"] as const,
  reviews: () => [...profileKeys.all, "reviews"] as const,
  reviewsWithOptions: (options: ReviewOptions) =>
    [...profileKeys.reviews(), options] as const,
  reviewSummary: () => [...profileKeys.all, "reviewSummary"] as const,
  ratingDistribution: () => [...profileKeys.all, "ratingDistribution"] as const,
  billing: () => [...profileKeys.all, "billing"] as const,
};

// Main hooks
useProfileOverview(); // User info + rental counts
useUserReviews(options); // Paginated reviews with sorting
useReviewSummary(); // Average rating + total count
useRatingDistribution(); // Rating breakdown (5-star, 4-star, etc)
useBillingInfo(); // Payment methods and billing

// Mutation hooks
useUpdateProfile(); // Profile updates with optimistic updates
```

## Component Structure

```
src/app/dashboard/profile/
├── layout.tsx                          # Updated to use client components
├── page.tsx                            # Routes to profile client component
├── reviews/page.tsx                    # Routes to profile client component (reviews tab)
├── billing/page.tsx                    # Routes to profile client component (billing tab)
└── _components/
    ├── profile-client.tsx              # Main client component with tabs
    ├── profile-overview-tab.tsx        # Overview tab with user info and stats
    ├── profile-reviews-tab.tsx         # Reviews tab with pagination and sorting
    ├── profile-billing-tab.tsx         # Billing info and payment methods
    └── profile-loading-skeleton.tsx    # Loading states for each tab
```

## Caching Strategy

### **Stale Times:**

- **Profile overview**: 30 seconds (user info changes occasionally)
- **Review summary**: 1 minute (rating updates from new reviews)
- **Reviews list**: 2 minutes (reviews don't change often)
- **Rating distribution**: 5 minutes (aggregate data changes slowly)
- **Billing info**: 2 minutes (payment methods change occasionally)

### **Cache Invalidation:**

- **On profile update**: Invalidate overview and related caches
- **On new review received**: Invalidate review summary, distribution, and reviews list
- **On billing update**: Invalidate billing cache

## Expected Performance Improvements

### **Before Optimization:**

- ❌ **Tab switch**: 1-2 second page reload + multiple database queries
- ❌ **Reviews pagination**: 800ms-1.5s server round trip per page
- ❌ **Profile updates**: Full page reload after submission
- ❌ **Browser navigation**: Full page reload

### **After Optimization:**

- ✅ **Tab switch**: **Instant** (cached data loads immediately)
- ✅ **Reviews pagination**: **50-100ms** (cached pages + smooth transitions)
- ✅ **Profile updates**: **Instant feedback** with optimistic updates
- ✅ **Browser navigation**: **Instant** (client-side routing)

## Implementation Benefits

### **User Experience:**

- **Native app feel** - Instant navigation between profile tabs
- **Smooth interactions** - No loading states for cached data
- **Real-time updates** - Verification status and other critical data
- **Better pagination** - Smooth reviews browsing experience

### **Developer Experience:**

- **Consistent patterns** - Same as rental and garage routes
- **Better debugging** - React Query DevTools
- **Easier testing** - Isolated hooks and components
- **Maintainable code** - Clear separation of concerns

### **Performance:**

- **Reduced server load** - 70-80% fewer database queries
- **Better caching** - Intelligent cache invalidation
- **Faster interactions** - Client-side state management
- **Improved metrics** - Better Core Web Vitals scores

## Unique Profile Considerations

### **Authentication-Heavy:**

- All profile data requires authentication
- User context is critical for all endpoints
- Security-sensitive data needs careful caching

### **Mixed Data Types:**

- **Static data**: User profile info
- **Dynamic data**: Reviews
- **Sensitive data**: Billing info
- **Aggregate data**: Review summaries, rating distributions

### **Form-Heavy Interface:**

- Profile editing forms with optimistic updates
- Billing forms with immediate feedback

### **Real-Time Requirements:**

- New review notifications

## Current Status

- **Phase 1**: Not Started
- **Phase 2**: Not Started
- **Phase 3**: Not Started
- **Phase 4**: Not Started
- **Phase 5**: Not Started

## Notes

- Follow the same patterns used in rental routes implementation
- Maintain compatibility with existing profile components where possible
- Use `tryCatch` from `@walkup/walkup-utils` for consistent error handling
- Keep query keys consistent and hierarchical for easy invalidation
- Implement proper authentication checks in all API routes
- Handle sensitive data (billing) with appropriate cache strategies
- Consider implementing optimistic updates for better UX on profile changes
