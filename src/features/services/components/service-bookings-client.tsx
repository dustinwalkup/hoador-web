"use client";

import Link from "next/link";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import {
  formatServiceUsd,
  serviceBookingStatusLabel,
} from "@/features/services/lib/service-labels";

interface ServiceBookingsClientProps {
  booked: ServiceBookingDashboardRow[];
  providing: ServiceBookingDashboardRow[];
}

function proposedDateLabel(row: ServiceBookingDashboardRow): string {
  const d = row.proposedDate as unknown;
  const dateStr =
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? "");
  return `${dateStr} ${row.proposedTime}`;
}

function BookingRow({ row }: { row: ServiceBookingDashboardRow }) {
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

/**
 * Tabs: bookings as requester vs as provider.
 */
export function ServiceBookingsClient({
  booked,
  providing,
}: ServiceBookingsClientProps) {
  const [tab, setTab] = useState<"booked" | "providing">("booked");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="booked">Booked</TabsTrigger>
        <TabsTrigger value="providing">Providing</TabsTrigger>
      </TabsList>
      <TabsContent value="booked" className="mt-4 space-y-3">
        {booked.length === 0 ? (
          <p className="text-muted-foreground text-sm">No bookings yet.</p>
        ) : (
          booked.map((row) => <BookingRow key={row.id} row={row} />)
        )}
      </TabsContent>
      <TabsContent value="providing" className="mt-4 space-y-3">
        {providing.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No incoming bookings yet.
          </p>
        ) : (
          providing.map((row) => <BookingRow key={row.id} row={row} />)
        )}
      </TabsContent>
    </Tabs>
  );
}
