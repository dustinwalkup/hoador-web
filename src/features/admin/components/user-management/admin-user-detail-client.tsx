"use client";

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
import { Loader2, ArrowLeft } from "lucide-react";
import { useAdminUser } from "@/features/admin/hooks/use-admin-user";
import { UserDetailActions } from "./user-detail-actions";

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

export function AdminUserDetailClient({ userId }: AdminUserDetailClientProps) {
  const { data: user, isLoading, error } = useAdminUser(userId);

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
              <span className="text-muted-foreground">Joined:</span>{" "}
              {formatDate(user.createdAt)}
            </p>
            <p>
              <span className="text-muted-foreground">ID verified:</span>{" "}
              {user.idVerified ? "Yes" : "No"}
            </p>
            <p>
              <span className="text-muted-foreground">Address verified:</span>{" "}
              {user.addressVerified ? "Yes" : "No"}
            </p>
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
    </div>
  );
}
