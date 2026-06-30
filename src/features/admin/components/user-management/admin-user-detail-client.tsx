"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Copy, Check } from "lucide-react";
import { useAdminUser } from "@/features/admin/hooks/use-admin-user";
import { UserDetailActions } from "./user-detail-actions";
import { DeleteUserDialog } from "./delete-user-dialog";

interface AdminUserDetailClientProps {
  userId: string;
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return (
      <p>
        <span className="text-muted-foreground">{label}:</span> —
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <code className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label={`Copy ${label}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function AdminUserDetailClient({ userId }: AdminUserDetailClientProps) {
  const { data: user, isLoading, error } = useAdminUser(userId);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="text-destructive py-12 text-center">
        <p>{error instanceof Error ? error.message : "User not found"}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/admin/dashboard/users">Back to users</Link>
        </Button>
      </div>
    );
  }

  const { stats } = user;
  const pm = user.primaryMembership;
  const otherCommunities = (user.communities ?? []).filter(
    (c) => c.id !== pm?.community.id,
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/admin/dashboard/users">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex gap-2">
            <Badge
              variant={
                user.status === "active"
                  ? "default"
                  : user.status === "suspended"
                    ? "destructive"
                    : "secondary"
              }
            >
              {user.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">{user.userType}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Community</CardTitle>
            <CardDescription>Membership and network</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pm ? (
              <>
                <p>
                  <span className="text-muted-foreground">
                    Primary community:
                  </span>{" "}
                  {pm.community.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Network:</span>{" "}
                  {pm.network ? pm.network.name : "— (no network)"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {pm.role === "admin" ? "Community admin" : "Member"}
                  </Badge>
                  <Badge
                    variant={
                      pm.verificationStatus === "verified"
                        ? "default"
                        : pm.verificationStatus === "denied"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {pm.verificationStatus}
                  </Badge>
                </div>
                {pm.verifiedAt && (
                  <p>
                    <span className="text-muted-foreground">Verified:</span>{" "}
                    {formatDate(pm.verifiedAt)}
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">
                    Joined community:
                  </span>{" "}
                  {formatDate(pm.joinedAt)}
                </p>
                {otherCommunities.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Also in:</span>{" "}
                    {otherCommunities.map((c) => c.name).join(", ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No primary community</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account &amp; compliance</CardTitle>
            <CardDescription>Identifiers and legal acceptances</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CopyField label="User ID" value={user.id} />
            <CopyField label="Stripe customer" value={user.stripeCustomerId} />
            <CopyField
              label="Connect account"
              value={user.stripeConnectedAccountId}
            />
            <div className="my-1 border-t" />
            <p>
              <span className="text-muted-foreground">Terms of Service:</span>{" "}
              {user.tosVersion ? `v${user.tosVersion}` : "—"}
              {user.tosAcceptedAt && ` · ${formatDate(user.tosAcceptedAt)}`}
            </p>
            <p>
              <span className="text-muted-foreground">Privacy Policy:</span>{" "}
              {user.privacyVersion ? `v${user.privacyVersion}` : "—"}
              {user.privacyAcceptedAt &&
                ` · ${formatDate(user.privacyAcceptedAt)}`}
            </p>
            <p>
              <span className="text-muted-foreground">
                Community agreement:
              </span>{" "}
              {user.communityVersion ? `v${user.communityVersion}` : "—"}
              {user.communityAcceptedAt &&
                ` · ${formatDate(user.communityAcceptedAt)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Listings, rentals, and disputes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Listings:</span>{" "}
              {user.listingsCount ?? 0}
            </p>
            <p>
              <span className="text-muted-foreground">Rentals as renter:</span>{" "}
              {user.rentalsAsRenterCount ?? 0}
            </p>
            <p>
              <span className="text-muted-foreground">Rentals as owner:</span>{" "}
              {user.rentalsAsOwnerCount ?? 0}
            </p>
            <p>
              <span className="text-muted-foreground">Total disputes:</span>{" "}
              {user.totalDisputesCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Basic account and verification info
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {user.name}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {user.email}
            </p>
            {user.phone && (
              <p>
                <span className="text-muted-foreground">Phone:</span>{" "}
                {user.phone}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Email verified:</span>{" "}
              {user.emailVerified ? "Yes" : "No"}
            </p>
            <p>
              <span className="text-muted-foreground">ID verified:</span>{" "}
              {user.idVerified ? "Yes" : "No"}
            </p>
            <p>
              <span className="text-muted-foreground">Address verified:</span>{" "}
              {user.addressVerified ? "Yes" : "No"}
            </p>
            {user.primaryAddress ? (
              <p>
                <span className="text-muted-foreground">Address:</span>{" "}
                {user.primaryAddress.street}, {user.primaryAddress.city},{" "}
                {user.primaryAddress.state} {user.primaryAddress.zipCode}
                {user.primaryAddress.country &&
                  user.primaryAddress.country !== "US" &&
                  `, ${user.primaryAddress.country}`}
              </p>
            ) : (
              <p>
                <span className="text-muted-foreground">Address:</span> —
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Joined:</span>{" "}
              {formatDate(user.createdAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Last login:</span>{" "}
              {user.lastLoginAt
                ? `${formatDateTime(user.lastLoginAt)} (${timeAgo(user.lastLoginAt)})`
                : "Never"}
            </p>
            <p>
              <span className="text-muted-foreground">Last active:</span>{" "}
              {user.lastActiveAt
                ? `${formatDateTime(user.lastActiveAt)} (${timeAgo(user.lastActiveAt)})`
                : "—"}
            </p>
            {user.updatedAt && (
              <p>
                <span className="text-muted-foreground">Profile updated:</span>{" "}
                {formatDate(user.updatedAt)}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Stripe Connect:</span>{" "}
              {user.connectOnboardingComplete ? "Complete" : "Not complete"}
              {user.connectChargesEnabled !== undefined && (
                <> • Charges: {user.connectChargesEnabled ? "Yes" : "No"}</>
              )}
              {user.connectPayoutsEnabled !== undefined && (
                <> • Payouts: {user.connectPayoutsEnabled ? "Yes" : "No"}</>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity stats</CardTitle>
            <CardDescription>Rentals and reviews</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Listings borrowed:</span>{" "}
              {stats?.listingsBorrowed ?? 0}
            </p>
            <p>
              <span className="text-muted-foreground">Listings shared:</span>{" "}
              {stats?.listingsShared ?? 0}
            </p>
            <p>
              <span className="text-muted-foreground">Average rating:</span>{" "}
              {stats?.averageRating ?? 0}
            </p>
            <p>
              <span className="text-muted-foreground">Total reviews:</span>{" "}
              {stats?.totalReviews ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin actions</CardTitle>
            <CardDescription>Change status or role</CardDescription>
          </CardHeader>
          <CardContent>
            <UserDetailActions
              userId={user.id}
              currentStatus={user.status}
              currentUserType={user.userType}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            Delete user
          </Button>
        </CardContent>
      </Card>

      <DeleteUserDialog
        userId={user.id}
        userName={user.name}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
