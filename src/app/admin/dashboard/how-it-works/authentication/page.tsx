import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Shield,
  Key,
  Lock,
  UserCheck,
  Users,
  LogIn,
  Fingerprint,
  ChevronRight,
} from "lucide-react";

export const metadata = {
  title: "How It Works - Authentication",
  description:
    "Bird's-eye view of sign-in, sessions, user status lifecycle, and role-based access",
};

const signUpFlowSteps = [
  {
    step: 1,
    page: "/signup",
    statusAfter: "pending_verification",
    description: "Email/password or Google OAuth; legal docs accepted",
  },
  {
    step: 2,
    page: "/verify-email",
    statusAfter: "email_verified",
    description: "Link sent via Resend; 24-hour expiry",
  },
  {
    step: 3,
    page: "/join-code",
    statusAfter: "incomplete_profile",
    description: "Enter community join code",
  },
  {
    step: 4,
    page: "/onboarding",
    statusAfter: "active",
    description: "Name, address, profile photo",
  },
];

const userStatuses = [
  {
    status: "pending_verification",
    description: "Email not yet verified (email signups)",
    badgeVariant: "secondary" as const,
  },
  {
    status: "email_verified",
    description: "Verified but needs community code",
    badgeVariant: "secondary" as const,
  },
  {
    status: "incomplete_profile",
    description: "Has code but needs onboarding",
    badgeVariant: "secondary" as const,
  },
  {
    status: "active",
    description: "Full access",
    badgeVariant: "default" as const,
  },
  {
    status: "inactive",
    description: "User deactivated",
    badgeVariant: "outline" as const,
  },
  {
    status: "suspended",
    description: "Admin action",
    badgeVariant: "destructive" as const,
  },
];

const routeCategories = [
  {
    category: "Protected",
    examples: "/dashboard, /api/rentals",
    protection: "Redirect to /login if unauthenticated",
  },
  {
    category: "Admin",
    examples: "/admin/dashboard",
    protection: "Redirect to /admin login if not admin",
  },
  {
    category: "Auth",
    examples: "/login, /signup",
    protection: "Redirect to /dashboard if already authenticated",
  },
  {
    category: "Public API",
    examples: "/api/auth, /api/profile",
    protection: "No protection",
  },
];

const roleCapabilities = [
  {
    role: "Standard",
    value: "standard",
    access: "Dashboard, rentals, messaging, listings",
  },
  {
    role: "Admin",
    value: "admin",
    access: "All standard features + admin dashboard, listing/dispute review",
  },
  {
    role: "Superadmin",
    value: "superadmin",
    access: "All admin features + future superadmin-only features",
  },
];

const keyFiles = [
  { label: "Better Auth config", path: "src/services/better-auth/index.ts" },
  { label: "Client auth", path: "src/services/better-auth/client.ts" },
  { label: "Session utilities", path: "src/features/auth/utils/session.ts" },
  { label: "Auth guards", path: "src/features/auth/utils/guards.ts" },
  { label: "Admin session", path: "src/features/auth/utils/admin-session.ts" },
  { label: "API route helpers", path: "src/lib/api/route-helpers.ts" },
  { label: "Middleware", path: "src/proxy.ts" },
  { label: "User schema", path: "src/db/schemas/user.schema.ts" },
  { label: "Enums", path: "src/db/schemas/_enums.ts" },
  { label: "User DAL", path: "src/dal/user.dal.ts" },
  { label: "Login page", path: "src/app/(auth)/login/page.tsx" },
  { label: "Signup page", path: "src/app/(auth)/signup/page.tsx" },
  {
    label: "Auth API handler",
    path: "src/app/api/auth/[...all]/route.ts",
  },
];

export default function HowItWorksAuthenticationPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Authentication"
        description="How sign-in, sessions, and authorization work"
      />

      {/* System Architecture Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            System Architecture Overview
          </CardTitle>
          <CardDescription>How authentication works end-to-end</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              <strong>Better Auth</strong> is the auth provider (configured in{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/services/better-auth/index.ts
              </code>
              ).
            </li>
            <li>
              Supports <strong>email/password</strong> and{" "}
              <strong>Google OAuth</strong> sign-in.
            </li>
            <li>
              Sessions are stored in PostgreSQL via the Drizzle adapter, tracked
              in a{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">session</code>{" "}
              table with tokens, expiry, IP, and user-agent.
            </li>
            <li>
              Server components call{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                getCurrentUser()
              </code>{" "}
              /{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                requireAuth()
              </code>{" "}
              from{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/features/auth/utils/session.ts
              </code>
              ; API routes use helpers from{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/lib/api/route-helpers.ts
              </code>
              .
            </li>
            <li>
              Middleware (
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/proxy.ts
              </code>
              ) intercepts every request, enforcing the user-status state
              machine and admin route protection.
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Sign-Up / Onboarding Flow */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="size-5" />
            Sign-Up / Onboarding Flow
          </CardTitle>
          <CardDescription>
            Steps new users follow from account creation to full access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Step</th>
                  <th className="px-3 py-2 text-left font-medium">Page</th>
                  <th className="px-3 py-2 text-left font-medium">
                    User Status After
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    What Happens
                  </th>
                </tr>
              </thead>
              <tbody>
                {signUpFlowSteps.map((row) => (
                  <tr
                    key={row.step}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{row.step}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.page}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.statusAfter}
                    </td>
                    <td className="px-3 py-2">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Status Lifecycle */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="size-5" />
            User Status Lifecycle
          </CardTitle>
          <CardDescription>
            Middleware enforces this progression — users cannot skip steps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {userStatuses.map((s) => (
              <Badge
                key={s.status}
                variant={s.badgeVariant}
                className={s.status === "active" ? "bg-primary/90" : undefined}
              >
                {s.status}
              </Badge>
            ))}
          </div>
          <ul className="space-y-2 text-sm">
            {userStatuses.map((s) => (
              <li key={s.status} className="flex items-start gap-2">
                <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span>
                  <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                    {s.status}
                  </code>{" "}
                  — {s.description}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Middleware Protection Layers */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Middleware Protection Layers
          </CardTitle>
          <CardDescription>
            Three-layer protection: middleware, layout guards, API helpers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>
              <strong>Middleware</strong> (
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/proxy.ts
              </code>
              ) — First line of defense; redirects unauthenticated users and
              enforces status-based routing.
            </li>
            <li>
              <strong>Layout guards</strong> (e.g.{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/app/admin/dashboard/layout.tsx
              </code>
              ) — Server-component-level{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                requireAdmin()
              </code>{" "}
              check.
            </li>
            <li>
              <strong>API route helpers</strong> (
              <code className="bg-muted rounded px-1.5 py-0.5">
                src/lib/api/route-helpers.ts
              </code>
              ) —{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                requireAuthResponse()
              </code>
              ,{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                requireAdminResponse()
              </code>
              ,{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                getAuthenticatedUserResponse()
              </code>{" "}
              return proper HTTP status codes.
            </li>
          </ol>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Example Routes
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    Protection
                  </th>
                </tr>
              </thead>
              <tbody>
                {routeCategories.map((row) => (
                  <tr
                    key={row.category}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{row.category}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.examples}
                    </td>
                    <td className="px-3 py-2">{row.protection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Role-Based Access Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Role-Based Access Control
          </CardTitle>
          <CardDescription>
            User types and guard functions: isAdmin(), requireAdmin(), etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Role</th>
                  <th className="px-3 py-2 text-left font-medium">Value</th>
                  <th className="px-3 py-2 text-left font-medium">Access</th>
                </tr>
              </thead>
              <tbody>
                {roleCapabilities.map((row) => (
                  <tr
                    key={row.value}
                    className="hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-3 py-2 font-medium">{row.role}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.value}</td>
                    <td className="px-3 py-2">{row.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm">
            Guard functions in{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              src/features/auth/utils/guards.ts
            </code>
            : <code className="bg-muted rounded px-1.5 py-0.5">isAdmin()</code>,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              requireAdmin()
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              isSuperAdmin()
            </code>
            ,{" "}
            <code className="bg-muted rounded px-1.5 py-0.5">
              requireSuperAdmin()
            </code>
            .
          </p>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="size-5" />
            Session Management
          </CardTitle>
          <CardDescription>
            How sessions are stored, retrieved, and used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-inside space-y-1.5 text-sm">
            <li>
              Stored in the{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">session</code>{" "}
              table (id, token, expiresAt, userId, ipAddress, userAgent).
            </li>
            <li>
              Retrieved server-side via{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                auth.api.getSession()
              </code>{" "}
              with request headers.
            </li>
            <li>
              Client-side via{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                useSession()
              </code>{" "}
              hook from Better Auth React client.
            </li>
            <li>HTTP-only cookies for security.</li>
            <li>
              Cached with React{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">cache()</code> to
              avoid duplicate DB calls per request.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Key Files Reference */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Key Files Reference
          </CardTitle>
          <CardDescription>
            Main files in the authentication system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 font-mono text-xs">
            {keyFiles.map((file) => (
              <li key={file.path} className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">{file.label}:</span>
                <code className="bg-muted rounded px-1.5 py-0.5 break-all">
                  {file.path}
                </code>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Future Improvements */}
      <Card>
        <CardHeader>
          <CardTitle>Future Improvements</CardTitle>
          <CardDescription>
            Known future work for the auth system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              Permission-based access control (the{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                hasPermission
              </code>{" "}
              function is stubbed in{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">guards.ts</code>
              ).
            </li>
            <li>Two-factor authentication.</li>
            <li>Session management UI (view/revoke active sessions).</li>
            <li>Rate limiting on auth endpoints.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
