"use client";

import Image from "next/image";
import { Calendar, Mail, Package, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";

export type AdminOwnerInformationOwner = {
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
  isVerified: boolean;
  email: string;
  createdAt: Date;
  otherListingsCount: number;
};

export type AdminOwnerInformationRating = {
  averageRating: number;
  totalCount: number;
  totalCountNoun: "rental" | "review";
};

interface AdminOwnerInformationProps {
  owner: AdminOwnerInformationOwner;
  rating: AdminOwnerInformationRating;
}

function formatJoinedDate(date: Date) {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function OwnerInformation({
  owner,
  rating,
}: AdminOwnerInformationProps) {
  const initials = `${owner.firstName?.charAt(0) ?? ""}${owner.lastName?.charAt(0) ?? ""}`;

  const totalLabel =
    rating.totalCount === 1
      ? rating.totalCountNoun
      : `${rating.totalCountNoun}s`;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">Owner Information</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          {owner.profileImageUrl ? (
            <Image
              src={owner.profileImageUrl}
              alt={`${owner.firstName} ${owner.lastName}`}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <span className="text-sm font-semibold">{initials}</span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {owner.firstName} {owner.lastName}
              </span>
              {owner.isVerified && (
                <Badge variant="default" className="text-xs">
                  Verified
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
              <Mail className="h-3 w-3" />
              {owner.email}
            </div>
            <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
              <Calendar className="h-3 w-3" />
              Joined {formatJoinedDate(owner.createdAt)}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="text-muted-foreground h-4 w-4" />
            <span className="text-sm">
              <span className="font-medium">{owner.otherListingsCount}</span>{" "}
              other listing{owner.otherListingsCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">
              <span className="font-medium">
                {rating.averageRating.toFixed(1)}
              </span>{" "}
              average rating ({rating.totalCount} {totalLabel})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
