# TanStack Query Implementation for Garage Routes

## Overview

Transform garage routes from server-side rendering to client-side caching using TanStack Query, following the same pattern as the rental routes for instant navigation between garage tabs and real-time filtering.

## Current State Analysis

### **Current Garage System:**

- ❌ **Server-side rendering on every tab change** - Full page reload for active/inactive/archived tabs
- ❌ **No caching** - Same data fetched repeatedly when switching tabs or changing filters
- ❌ **Suspense boundaries** causing loading states on every filter change
- ❌ **Direct DAL calls in RSC** - `await listingDAL.getUserActiveListingsWithFilters()` on every route
- ❌ **URL state management** but with full page reloads

### **Current DAL Methods:**

- `listingDAL.getUserActiveListingsWithFilters(userId, filters)`
- `listingDAL.getUserInactiveListingsWithFilters(userId, filters)`
- `listingDAL.getUserArchivedListingsWithFilters(userId, filters)`
- `listingDAL.getListingCategories()`

## Implementation Checklist

### Phase 1: API Routes Foundation

- [x] Create `/src/app/api/garage/active/route.ts`
- [x] Create `/src/app/api/garage/inactive/route.ts`
- [x] Create `/src/app/api/garage/archived/route.ts`
- [x] Create `/src/app/api/garage/categories/route.ts`
- [x] Test all API endpoints manually
- [x] Verify API responses match DAL return types

### Phase 2: TanStack Query Hooks

- [x] Create `/src/features/listings/hooks/use-garage.ts`
- [x] Implement `useActiveListings(filters)` hook
- [x] Implement `useInactiveListings(filters)` hook
- [x] Implement `useArchivedListings(filters)` hook
- [x] Implement `useGarageCategories()` hook
- [x] Define consistent query keys structure
- [x] Set appropriate stale times for different data types
- [x] Add URL state management hook (`useGarageFilters`)
- [x] Test hooks in isolation

### Phase 3: Convert Pages to Client Components

- [x] Create `/src/app/dashboard/garage/_components/garage-client.tsx`
- [x] Create loading skeleton component
- [x] Create error handling component
- [x] Convert active/inactive/archived tabs to use hooks
- [x] Update `/src/app/dashboard/garage/page.tsx`
- [x] Implement instant tab switching with cached data
- [x] Add real-time filter updates with URL sync
- [x] Test tab switching performance
- [x] Verify data consistency between old and new implementations
- [x] Remove old server-side data fetching code

### Phase 4: Performance & Polish

- [ ] Add prefetching for likely next actions
- [ ] Implement proper loading states for all components
- [ ] Add error boundaries and retry mechanisms
- [ ] Fine-tune cache stale times based on usage
- [ ] Add background refetching for critical data
- [ ] Implement cache invalidation strategies
- [ ] Performance testing and optimization

### Phase 5: Advanced Features (Future)

- [ ] Add optimistic updates for listing status changes
- [ ] Implement real-time updates when listings are modified
- [ ] Add infinite scroll for large listing collections
- [ ] Implement advanced search with autocomplete

## Performance Goals

- **Tab Switching**: 95% faster (instant cached data)
- **Filter Changes**: 90% faster (instant URL updates with cached results)
- **First Load**: Same speed (initial API call)
- **Search**: 85% faster with debounced input and cached results

## API Routes Structure

```
src/app/api/garage/
├── active/route.ts        # GET /api/garage/active?query=&category=&sortBy=&sortOrder=&rentalStatus=
├── inactive/route.ts      # GET /api/garage/inactive?query=&category=&sortBy=&sortOrder=
├── archived/route.ts      # GET /api/garage/archived?query=&category=&sortBy=&sortOrder=
└── categories/route.ts    # GET /api/garage/categories
```

## TanStack Query Hooks Structure

```typescript
// Query keys for consistent caching
export const garageKeys = {
  all: ['garage'] as const,
  active: () => [...garageKeys.all, 'active'] as const,
  activeWithFilters: (filters: GarageListingFilters) =>
    [...garageKeys.active(), filters] as const,
  inactive: () => [...garageKeys.all, 'inactive'] as const,
  inactiveWithFilters: (filters: GarageListingFilters) =>
    [...garageKeys.inactive(), filters] as const,
  archived: () => [...garageKeys.all, 'archived'] as const,
  archivedWithFilters: (filters: GarageListingFilters) =>
    [...garageKeys.archived(), filters] as const,
  categories: () => [...garageKeys.all, 'categories'] as const,
};

// Main hooks
useActiveListings(filters: GarageListingFilters)
useInactiveListings(filters: GarageListingFilters)
useArchivedListings(filters: GarageListingFilters)
useGarageCategories()

// URL state management
useGarageFilters() // Returns { filters, updateFilters }
```

## Component Structure

```
src/app/dashboard/garage/
├── page.tsx                           # Updated to use client components
└── _components/
    ├── garage-client.tsx              # Main client component with tabs and filtering
    ├── garage-filters-client.tsx      # Client-side filters with URL sync
    ├── garage-tabs-client.tsx         # Client-side tabs with instant switching
    ├── active-listings.tsx            # Client component for active listings
    ├── inactive-listings.tsx          # Client component for inactive listings
    ├── archived-listings.tsx          # Client component for archived listings
    ├── garage-loading-skeleton.tsx    # Loading skeleton components
    └── garage-error.tsx               # Error handling components
```

## URL State Management Strategy

### **Current URL Structure:**

```
/dashboard/garage?tab=active&q=drill&category=tools&sortBy=name&sortOrder=asc&rentalStatus=available
```

### **Enhanced URL State:**

- ✅ **Instant URL updates** - No page reloads
- ✅ **Shareable URLs** - Full filter state in URL
- ✅ **Browser navigation** - Back/forward buttons work
- ✅ **Debounced search** - Smooth search experience
- ✅ **Filter persistence** - Filters maintained across tab switches

## Caching Strategy

### **Stale Times:**

- **Active listings**: 30 seconds (frequently changing - rental status updates)
- **Inactive listings**: 2 minutes (changes less frequently)
- **Archived listings**: 5 minutes (rarely changes)
- **Categories**: 10 minutes (static data)

### **Cache Invalidation:**

- **On listing status change**: Invalidate active/inactive caches
- **On listing edit**: Invalidate specific listing and related caches
- **On new listing**: Invalidate active listings cache
- **On listing archive**: Invalidate active/inactive and refresh archived

## Expected Performance Improvements

### **Before Optimization:**

- ❌ **Tab switch**: 1-2 second page reload + database query
- ❌ **Filter change**: 800ms-1.5s server round trip
- ❌ **Search**: New request on every keystroke (if not debounced)
- ❌ **Browser navigation**: Full page reload

### **After Optimization:**

- ✅ **Tab switch**: **Instant** (cached data loads immediately)
- ✅ **Filter change**: **50-100ms** (instant URL update + cached results)
- ✅ **Search**: **300ms debounced** with instant local feedback
- ✅ **Browser navigation**: **Instant** (URL state management)

## Implementation Benefits

### **User Experience:**

- **Native app feel** - Instant navigation and filtering
- **Smooth interactions** - No loading states for cached data
- **Better search** - Debounced input with instant feedback
- **Shareable URLs** - Full filter state preserved

### **Developer Experience:**

- **Consistent patterns** - Same as rental routes implementation
- **Better debugging** - React Query DevTools
- **Easier testing** - Isolated hooks and components
- **Maintainable code** - Clear separation of concerns

### **Performance:**

- **Reduced server load** - 70-80% fewer database queries
- **Better caching** - Intelligent cache invalidation
- **Faster interactions** - Client-side state management
- **Improved SEO** - Proper URL structure for filters

## Current Status

- **Phase 1**: ✅ Completed
- **Phase 2**: ✅ Completed
- **Phase 3**: ✅ Completed
- **Phase 4**: Not Started
- **Phase 5**: Not Started

## Notes

- Follow the same patterns used in rental routes implementation
- Maintain compatibility with existing `RentalCard` component
- Use `tryCatch` from `@walkup/walkup-utils` for consistent error handling
- Keep query keys consistent and hierarchical for easy invalidation
- Preserve existing URL structure for backward compatibility
- Implement proper TypeScript types for all data structures
