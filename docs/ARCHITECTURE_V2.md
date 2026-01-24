# Backend Architecture v2

## Overview

This architecture establishes clear boundaries between layers:

- **API Routes**: Authentication, authorization, request/response handling
- **DAL (Data Access Layer)**: Pure database operations, no auth logic
- **React Query**: Client-side state management (queries + mutations)
- **Server Components**: Direct DAL access with inline auth checks (transitional pattern)

---

## Core Principles

### 1. DAL is Auth-Agnostic

The DAL performs database transactions only. It receives parameters like `userId` when needed for filtering - it does NOT verify authentication or authorization.

### 2. API Routes Handle Auth for Client Requests

All client-side data access goes through API routes. Auth checks happen in the route before calling DAL.

### 3. Server Components Handle Their Own Auth (Transitional)

Server Components check auth inline, then call DAL directly. This pattern will eventually migrate to a service layer.

### 4. React Query for All Client-Side Data

- `useQuery` for data fetching → calls API routes
- `useMutation` for data changes → calls API routes
- No server actions

---

## Layer Responsibilities

### API Routes (`/app/api/`)

**Responsibilities:**

- Authenticate requests (verify session/token)
- Authorize requests (verify user has permission)
- Validate request data (using Zod schemas)
- Call DAL methods with verified parameters
- Format and return responses
- Handle errors and return appropriate HTTP status codes

**⚠️ IMPORTANT: Use Route Helpers for Consistency**

Always use the helpers from `@/lib/api/route-helpers` for authentication:

| Helper                           | Use Case                                                 |
| -------------------------------- | -------------------------------------------------------- |
| `getAuthenticatedUserResponse()` | **Primary** - Returns 401 OR `{ user, userId, isAdmin }` |
| `requireAdminResponse()`         | Admin-only routes - Returns 403 OR null                  |
| `handleApiError()`               | Catch-all error handler - Maps errors to HTTP status     |

**Pattern (Protected Endpoint):**

```typescript
// src/app/api/tools/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { ToolDAL } from "@/dal/tool.dal";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 1. Authenticate - ALWAYS use getAuthenticatedUserResponse()
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId, isAdmin } = authResult;

    // 2. Fetch resource
    const tool = await ToolDAL.getById(params.id);
    if (!tool) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 3. Authorize (owner or admin)
    if (tool.ownerId !== userId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Validate & Execute
    const body = await request.json();
    const result = await ToolDAL.update(params.id, body);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 1. Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, isAdmin } = authResult;

    // 2. Fetch & Authorize
    const tool = await ToolDAL.getById(params.id);
    if (!tool) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (tool.ownerId !== userId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Execute
    await ToolDAL.delete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Pattern (Public Endpoint):**

```typescript
// src/app/api/tools/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/route-helpers";
import { ToolDAL } from "@/dal/tool.dal";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // No auth required for public endpoint
    const tool = await ToolDAL.getById(params.id);

    if (!tool) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(tool);
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Pattern (Admin-Only Endpoint):**

```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { UserDAL } from "@/dal/user.dal";

export async function GET(request: NextRequest) {
  try {
    // Require admin - returns 401 (not auth) or 403 (not admin)
    const adminCheck = await requireAdminResponse();
    if (adminCheck) {
      return adminCheck;
    }

    const users = await UserDAL.getAll();
    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

### DAL (Data Access Layer)

**Responsibilities:**

- Execute database queries using Drizzle ORM
- Handle database transactions
- Return typed data
- ❌ NO authentication logic
- ❌ NO authorization logic

**Changes from v1:**

- Remove `getCurrentUserId()` calls
- Remove `requireAuth()` calls
- Remove `this.requireAuth()` from BaseDAL
- Accept `userId` as parameter when needed for filtering
- Remove `UnauthorizedError` throws
- DAL methods are pure database operations

**Pattern:**

```typescript
// src/dal/tool.dal.ts
import { db } from "@/db/db";
import { tools } from "@/db/schemas/tools";
import { eq } from "drizzle-orm";

export class ToolDAL {
  // Pure database query - no auth
  static async getById(id: string) {
    const result = await db
      .select()
      .from(tools)
      .where(eq(tools.id, id))
      .limit(1);

    return result[0] || null;
  }

  // userId is a parameter, not fetched internally
  static async getByOwner(ownerId: string) {
    return db.select().from(tools).where(eq(tools.ownerId, ownerId));
  }

  // Caller is responsible for authorization
  static async update(id: string, data: Partial<Tool>) {
    const result = await db
      .update(tools)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tools.id, id))
      .returning();

    return result[0];
  }

  // ownerId passed in from caller (API route or Server Component)
  static async create(data: CreateToolInput & { ownerId: string }) {
    const result = await db.insert(tools).values(data).returning();

    return result[0];
  }

  static async delete(id: string) {
    await db.delete(tools).where(eq(tools.id, id));
  }
}
```

**BaseDAL Changes:**

```typescript
// src/dal/base.ts
export class BaseDAL {
  // Remove requireAuth() method
  // Remove getCurrentUserId() method
  // Keep only shared database utilities if any
}
```

---

### React Query (Client Components)

**All client-side data fetching and mutations go through React Query hooks that call API routes.**

**Queries (Data Fetching):**

```typescript
// src/features/tools/hooks/use-tool.ts
import { useQuery } from "@tanstack/react-query";

export function useTool(toolId: string | null) {
  return useQuery({
    queryKey: ["tool", toolId],
    queryFn: async () => {
      const response = await fetch(`/api/tools/${toolId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch tool");
      }
      return response.json();
    },
    enabled: !!toolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserTools() {
  return useQuery({
    queryKey: ["user-tools"],
    queryFn: async () => {
      const response = await fetch("/api/tools/user");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch tools");
      }
      return response.json();
    },
    staleTime: 1 * 60 * 1000,
  });
}
```

**Mutations (Data Changes):**

```typescript
// src/features/tools/hooks/use-create-tool.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export function useCreateTool() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateToolInput) => {
      const response = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tool");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tools"] });
      toast({ title: "Success", description: "Tool created" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// src/features/tools/hooks/use-update-tool.ts
export function useUpdateTool() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateToolInput }) => {
      const response = await fetch(`/api/tools/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tool");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tool", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["user-tools"] });
      toast({ title: "Success", description: "Tool updated" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// src/features/tools/hooks/use-delete-tool.ts
export function useDeleteTool() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/tools/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete tool");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tools"] });
      toast({ title: "Success", description: "Tool deleted" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
```

**Using Mutations in Components:**

```typescript
// src/features/tools/components/tool-form.tsx
"use client";

import { useCreateTool } from "../hooks/use-create-tool";

export function ToolForm() {
  const createTool = useCreateTool();

  const handleSubmit = (formData: FormData) => {
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: Number(formData.get("price")),
    };

    createTool.mutate(data);
  };

  return (
    <form action={handleSubmit}>
      <input name="name" required />
      <textarea name="description" />
      <input name="price" type="number" required />
      <button type="submit" disabled={createTool.isPending}>
        {createTool.isPending ? "Creating..." : "Create Tool"}
      </button>
    </form>
  );
}
```

---

### Server Components (Transitional Pattern)

**For now: Auth check inline, then call DAL directly.**
**Future: Will migrate to service layer.**

**⚠️ IMPORTANT: Use Session Helpers for Consistency**

Use helpers from `@/features/auth/utils/session`:

| Helper                       | Use Case                                                           |
| ---------------------------- | ------------------------------------------------------------------ |
| `getAuthenticatedUser()`     | Returns `null` OR `{ user, userId, isAdmin }` - check and redirect |
| `requireAuthenticatedUser()` | Throws if not auth - use with error boundary                       |
| `getCurrentUserId()`         | Returns `string \| null` - simple ID check                         |

**Pattern (Protected Page - Redirect):**

```typescript
// src/app/dashboard/garage/page.tsx
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/features/auth/utils/session";
import { ToolDAL } from "@/dal/tool.dal";

export default async function GaragePage() {
  // 1. Auth check - use getAuthenticatedUser() for consistency
  const auth = await getAuthenticatedUser();
  if (!auth) {
    redirect("/sign-in");
  }
  const { userId, isAdmin } = auth;

  // 2. Call DAL directly with userId
  const tools = await ToolDAL.getByOwner(userId);

  return <GarageContent tools={tools} isAdmin={isAdmin} />;
}
```

**Pattern (Protected Page - Throw):**

```typescript
// src/app/dashboard/settings/page.tsx
import { requireAuthenticatedUser } from "@/features/auth/utils/session";
import { UserDAL } from "@/dal/user.dal";

export default async function SettingsPage() {
  // Throws if not authenticated - caught by error boundary
  const { userId, user } = await requireAuthenticatedUser();

  const settings = await UserDAL.getSettings(userId);

  return <SettingsForm user={user} settings={settings} />;
}
```

**Pattern (Public Page):**

```typescript
// src/app/listings/[id]/page.tsx
import { notFound } from "next/navigation";
import { ToolDAL } from "@/dal/tool.dal";

export default async function ListingPage({
  params
}: {
  params: { id: string }
}) {
  // No auth required for public endpoint
  const tool = await ToolDAL.getById(params.id);

  if (!tool) {
    notFound();
  }

  return <ListingDetails tool={tool} />;
}
```

---

## Data Flow Diagrams

### Client Component → API Route → DAL

```
User Action (click, form submit)
    ↓
React Query Hook (useQuery / useMutation)
    ↓
fetch("/api/...")
    ↓
API Route
    ├── 1. Authenticate (getSession)
    ├── 2. Authorize (check permissions)
    ├── 3. Validate (Zod schema)
    └── 4. Call DAL method
              ↓
         Database
              ↓
         Return data
    ↓
API Response (JSON)
    ↓
React Query Cache Update
    ↓
Component Re-render
```

### Server Component → DAL (Transitional)

```
Server Component Render
    ↓
getSession() - inline auth check
    ↓
redirect() if unauthorized
    ↓
DAL.method(userId, ...) - database query
    ↓
Return data
    ↓
Render JSX
```

---

## Error Handling

### API Route Error Responses

```typescript
// 401 - Not authenticated
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 403 - Authenticated but not authorized
return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// 404 - Resource not found
return NextResponse.json({ error: "Not found" }, { status: 404 });

// 400 - Bad request / validation failed
return NextResponse.json(
  {
    error: "Validation failed",
    details: zodError.errors,
  },
  { status: 400 },
);

// 500 - Server error
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
```

### DAL Error Handling

```typescript
// DAL throws database-level errors only
// Use tryCatch for consistent handling
const result = await tryCatch(
  () => ToolDAL.create(data),
  (error) => {
    console.error("Database error:", error);
    return { success: false, error: "Database operation failed" };
  },
);
```

### Client Error Handling

```typescript
// React Query handles errors automatically
// Use onError callback for user feedback
const mutation = useCreateTool();

// Errors show via toast in the hook's onError
// Or handle manually:
if (mutation.error) {
  // Display error state in UI
}
```

---

## File Structure

```
src/
├── app/
│   ├── api/                    # API routes (auth + DAL calls)
│   │   ├── tools/
│   │   │   ├── route.ts        # GET (list), POST (create)
│   │   │   ├── [id]/
│   │   │   │   └── route.ts    # GET, PUT, DELETE
│   │   │   └── user/
│   │   │       └── route.ts    # GET user's tools
│   │   ├── rentals/
│   │   └── users/
│   └── dashboard/              # Server Components (auth + DAL)
│       └── garage/
│           └── page.tsx
│
├── dal/                        # Pure database operations
│   ├── base.ts                 # Shared utilities (no auth)
│   ├── tool.dal.ts
│   ├── rental.dal.ts
│   └── user.dal.ts
│
├── features/
│   └── tools/
│       ├── hooks/              # React Query hooks
│       │   ├── use-tool.ts
│       │   ├── use-tools.ts
│       │   ├── use-user-tools.ts
│       │   ├── use-create-tool.ts
│       │   ├── use-update-tool.ts
│       │   └── use-delete-tool.ts
│       ├── components/
│       └── types.ts
│
└── lib/
    ├── api/
    │   └── route-helpers.ts    # Auth helpers for API routes
    └── auth/
        └── session.ts          # getSession helper
```

---

## Migration Checklist

### Phase 1: Update DAL

- [ ] Remove `requireAuth()` from BaseDAL
- [ ] Remove `getCurrentUserId()` from BaseDAL
- [ ] Remove auth calls from all DAL methods
- [ ] Add `userId` parameters where needed
- [ ] Remove `UnauthorizedError` imports/throws
- [ ] Test DAL methods work with parameters

### Phase 2: Update/Create API Routes

- [ ] Use `getAuthenticatedUserResponse()` for all protected routes
- [ ] Use `requireAdminResponse()` for admin-only routes
- [ ] Use `handleApiError()` in catch blocks
- [ ] Add authorization checks (ownership, roles) after auth
- [ ] Add Zod validation where needed
- [ ] Ensure proper HTTP status codes
- [ ] Test all endpoints

### Phase 3: Create React Query Hooks

- [ ] Create query hooks for each data type
- [ ] Create mutation hooks for create/update/delete
- [ ] Add proper cache invalidation
- [ ] Add toast notifications in hooks
- [ ] Add optimistic updates where beneficial

### Phase 4: Migrate Client Components

- [ ] Replace server actions with mutation hooks
- [ ] Replace direct fetches with query hooks
- [ ] Update loading/error states
- [ ] Test all user flows

### Phase 5: Update Server Components

- [ ] Use `getAuthenticatedUser()` or `requireAuthenticatedUser()` for auth
- [ ] Pass userId to DAL methods (from auth result)
- [ ] Remove server action calls
- [ ] Test all pages

### Phase 6: Cleanup

- [ ] Remove unused server actions files
- [ ] Remove auth utilities from DAL
- [ ] Update types/interfaces
- [ ] Update workspace rules (.cursorrules)
- [ ] Update tests

---

## Quick Reference

### API Route Helpers (`@/lib/api/route-helpers`)

| Function                         | Returns                                             | Use When                               |
| -------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `getAuthenticatedUserResponse()` | `NextResponse (401)` OR `{ user, userId, isAdmin }` | **Default** - Most protected endpoints |
| `requireAdminResponse()`         | `NextResponse (401/403)` OR `null`                  | Admin-only endpoints                   |
| `handleApiError(error)`          | `NextResponse` with appropriate status              | Catch block for all errors             |

### Server Component Helpers (`@/features/auth/utils/session`)

| Function                     | Returns                                          | Use When                      |
| ---------------------------- | ------------------------------------------------ | ----------------------------- |
| `getAuthenticatedUser()`     | `null` OR `{ user, userId, isAdmin }`            | Check auth + redirect if null |
| `requireAuthenticatedUser()` | `{ user, userId, isAdmin }` (throws if not auth) | Use with error boundary       |
| `getCurrentUserId()`         | `string \| null`                                 | Simple ID-only check          |

### Layer Responsibilities

| Layer            | Auth Responsibility                     | Data Access       |
| ---------------- | --------------------------------------- | ----------------- |
| API Route        | ✅ Use `getAuthenticatedUserResponse()` | Call DAL          |
| Server Component | ✅ Use `getAuthenticatedUser()`         | Call DAL directly |
| DAL              | ❌ None                                 | Database queries  |
| React Query      | ❌ None                                 | Call API routes   |
| Server Component | ✅ Check auth (inline)                  | Call DAL directly |

| Action                     | Pattern                             |
| -------------------------- | ----------------------------------- |
| Client fetches data        | `useQuery` → API route → DAL        |
| Client mutates data        | `useMutation` → API route → DAL     |
| Server renders page        | Server Component → auth check → DAL |
| Server renders public page | Server Component → DAL              |
