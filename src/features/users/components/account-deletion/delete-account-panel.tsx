"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/features/auth/utils";
import type { AccountDeletionBlocker } from "@/features/users/lib/account-deletion-errors";
import {
  useDeleteAccount,
  useDeletionBlockers,
} from "@/features/users/hooks/use-account-deletion";

/** What the user types to arm the button, as in the mobile app. */
export const DELETE_CONFIRMATION = "DELETE";

export const SUPPORT_EMAIL = "admin@hoador.com";

/** Where each blocker gets resolved. */
const BLOCKER_LINKS: Record<
  AccountDeletionBlocker["type"],
  { label: string; href: string }
> = {
  active_rentals: { label: "Go to your dashboard", href: "/dashboard" },
  active_bookings: { label: "Go to services", href: "/dashboard/services" },
  pending_requests: { label: "Go to your dashboard", href: "/dashboard" },
  deposit_holds: { label: "Go to your dashboard", href: "/dashboard" },
  incomplete_payouts: {
    label: "Go to payouts",
    href: "/dashboard/payments/earnings-and-payouts",
  },
  open_disputes: { label: "Go to disputes", href: "/dashboard/disputes" },
};

/**
 * The signed-in half of `/account/delete` (Req 23.6.2, P-E15-5): blockers
 * first, then a typed confirmation, then the DELETE. Mirrors the mobile app's
 * delete-account screen (14.3.3) so both say and do the same thing.
 *
 * If the blockers read fails, the confirm form shows anyway: the DELETE
 * re-checks, and a blocked attempt changes nothing.
 */
export function DeleteAccountPanel() {
  const blockers = useDeletionBlockers();
  const [deleted, setDeleted] = useState(false);
  const [blockedOnDelete, setBlockedOnDelete] = useState<
    AccountDeletionBlocker[] | null
  >(null);

  if (deleted) return <DeletedView />;

  if (blockers.isPending) {
    return (
      <div
        className="text-muted-foreground flex items-center gap-2 py-6"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Checking your account…
      </div>
    );
  }

  const list = blockedOnDelete ?? blockers.data ?? [];
  if (list.length > 0) {
    return (
      <BlockedView
        blockers={list}
        rechecking={blockers.isFetching}
        onRecheck={() => {
          setBlockedOnDelete(null);
          void blockers.refetch();
        }}
      />
    );
  }

  return (
    <ConfirmView
      onDeleted={() => setDeleted(true)}
      onBlocked={setBlockedOnDelete}
    />
  );
}

function BlockedView({
  blockers,
  rechecking,
  onRecheck,
}: {
  blockers: AccountDeletionBlocker[];
  rechecking: boolean;
  onRecheck: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="delete-account-blocked">
      <h2 className="text-xl font-semibold">
        You can&apos;t delete your account yet
      </h2>
      <p className="text-muted-foreground">
        These need to wrap up before your account can be deleted.
      </p>
      <ul className="space-y-3">
        {blockers.map((blocker) => {
          const link = BLOCKER_LINKS[blocker.type];
          return (
            <li
              key={blocker.type}
              className="bg-card space-y-2 rounded-lg border p-4"
              data-testid={`delete-account-blocker-${blocker.type}`}
            >
              <p>{blocker.message}</p>
              {link ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button variant="outline" onClick={onRecheck} disabled={rechecking}>
        {rechecking ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        Check again
      </Button>
    </div>
  );
}

function ConfirmView({
  onDeleted,
  onBlocked,
}: {
  onDeleted: () => void;
  onBlocked: (blockers: AccountDeletionBlocker[]) => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deleteAccount = useDeleteAccount();
  const armed = typed.trim() === DELETE_CONFIRMATION;

  const onDelete = () => {
    if (!armed || deleteAccount.isPending) return;
    setError(null);
    deleteAccount.mutate(undefined, {
      onSuccess: async (result) => {
        if (result.status === "blocked") {
          onBlocked(result.blockers);
          return;
        }
        // The server already revoked every session; this clears the browser's
        // cookie. Best-effort: the account is gone either way.
        await signOut().catch(() => {});
        onDeleted();
      },
      onError: () => {
        setError(
          `We couldn't delete your account. Try again, or email ${SUPPORT_EMAIL} if this keeps happening.`,
        );
      },
    });
  };

  return (
    <div className="space-y-4" data-testid="delete-account-confirm">
      <p className="font-semibold">This can&apos;t be undone.</p>
      <div className="space-y-2">
        <Label htmlFor="delete-confirmation">
          Type {DELETE_CONFIRMATION} to confirm
        </Label>
        <Input
          id="delete-confirmation"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={DELETE_CONFIRMATION}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        variant="destructive"
        onClick={onDelete}
        disabled={!armed || deleteAccount.isPending}
      >
        {deleteAccount.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        Delete my account
      </Button>
    </div>
  );
}

function DeletedView() {
  return (
    <div className="space-y-4" data-testid="delete-account-done" role="status">
      <h2 className="text-xl font-semibold">Your account has been deleted</h2>
      <p className="text-muted-foreground">
        You&apos;ve been signed out on every device. Thanks for being part of
        Hoador.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to Hoador</Link>
      </Button>
    </div>
  );
}
