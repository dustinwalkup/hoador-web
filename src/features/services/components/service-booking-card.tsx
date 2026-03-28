"use client";

import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import {
  formatServiceUsd,
  serviceBookingStatusLabel,
} from "@/features/services/lib/service-labels";

export function proposedDateLabel(row: ServiceBookingDashboardRow): string {
  const d = row.proposedDate as unknown;
  const dateStr =
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? "");
  return `${dateStr} ${row.proposedTime}`;
}

export function ServiceBookingCard({
  row,
}: {
  row: ServiceBookingDashboardRow;
}) {
  const cp = row.counterparty;
  const name = [cp.firstName, cp.lastName].filter(Boolean).join(" ") || "User";
  const initials = `${cp.firstName?.[0] ?? ""}${cp.lastName?.[0] ?? ""}` || "?";

  return (
    <Link
      href={`/dashboard/services/bookings/${row.id}`}
      className="hover:bg-muted/50 flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10">
          <AvatarImage src={cp.profileImageUrl ?? undefined} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{row.listingTitle}</p>
          <p className="text-muted-foreground truncate text-sm">{name}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className="text-muted-foreground text-sm">
          {proposedDateLabel(row)}
        </span>
        <Badge variant="outline">{serviceBookingStatusLabel(row.status)}</Badge>
        <span className="text-muted-foreground text-sm">
          {formatServiceUsd(row.totalAmount)}
        </span>
      </div>
    </Link>
  );
}
