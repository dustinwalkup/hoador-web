"use client";

import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import {
  formatServiceUsd,
  serviceBookingStatusLabel,
} from "@/features/services/lib/service-labels";

function parseBookingProposedAt(row: ServiceBookingDashboardRow): Date | null {
  const raw = row.proposedDate as unknown;
  let datePart: string;
  if (raw instanceof Date) {
    datePart = raw.toISOString().slice(0, 10);
  } else {
    datePart = String(raw ?? "").slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  const timeRaw = String(row.proposedTime ?? "00:00").trim();
  const [hStr, mStr] = timeRaw.split(":");
  const hours = Number.parseInt(hStr ?? "0", 10);
  const minutes = Number.parseInt(mStr ?? "0", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const [y, mo, da] = datePart.split("-").map((x) => Number.parseInt(x, 10));
  const d = new Date(y, mo - 1, da, hours, minutes, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Long-form scheduled date/time for booking list cards (e.g. "April 1, 2026, 9:00 AM").
 */
export function proposedDateLabel(row: ServiceBookingDashboardRow): string {
  const d = parseBookingProposedAt(row);
  if (!d) {
    const raw = row.proposedDate as unknown;
    const dateStr =
      raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? "");
    return `${dateStr} ${row.proposedTime}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
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
