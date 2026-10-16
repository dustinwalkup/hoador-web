import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getSession } from "@/features/auth/utils/session";
import {
  DeleteAccountPanel,
  SUPPORT_EMAIL,
} from "@/features/users/components/account-deletion/delete-account-panel";

export const metadata: Metadata = {
  title: "Delete your Hoador account",
  description:
    "How to delete your Hoador account and what happens to your data, for the website and the Hoador mobile app.",
  alternates: { canonical: "/account/delete" },
};

// Reads the session, so it can't be prerendered.
export const dynamic = "force-dynamic";

/**
 * What deletion does, matching `deleteOwnAccount` and the mobile app's
 * `DELETION_CONSEQUENCES` (14.3.3). Keep the two lists in step.
 */
const CONSEQUENCES = [
  "Your profile is anonymized, and your listings, services and needs are removed from discovery.",
  "Requests you've sent that are still pending are cancelled.",
  "Your rentals, bookings, payments, disputes and messages are kept for our records, under an anonymized name.",
  "Photos you uploaded are deleted: your profile photo, listing and service photos, and your dispute evidence.",
  "Rental and service agreements are kept too, and may stay reachable at links someone already has.",
  "Saved payment cards are removed, and a linked Sign in with Apple is disconnected.",
  "You'll be signed out on every device.",
];

/**
 * Account deletion on the web (Req 23.6.2, P-E15-5).
 *
 * Google Play requires a web page where people can delete their account
 * without installing the app; this URL goes in the Play Data safety form.
 * It's public: signed out, it explains the process and links to sign-in
 * (coming back here); signed in, it runs the same blockers → typed confirm →
 * delete flow as the app. The settings page's Delete Account button links here.
 */
export default async function DeleteAccountPage() {
  const session = await getSession();

  return (
    <div className="bg-background min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo
              width={100}
              height={40}
              style={{ height: "1.5rem", width: "auto" }}
            />
            <span className="sr-only">Hoador home</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-8 px-4 py-12">
        <section className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Delete your Hoador account
          </h1>
          <p className="text-muted-foreground">
            This deletes your account on the Hoador website and in the Hoador
            app for iPhone and Android. They share one account.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="what-happens">
          <h2 id="what-happens" className="text-xl font-semibold">
            When you delete your account
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            {CONSEQUENCES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            Records we keep are retained only as long as we need them for
            accounting, legal and dispute obligations.
          </p>
        </section>

        <section
          className="space-y-4 rounded-lg border p-6"
          aria-label="Delete account"
        >
          {session ? (
            <DeleteAccountPanel />
          ) : (
            <div className="space-y-4" data-testid="delete-account-signed-out">
              <p>Sign in to the account you want to delete, then come back.</p>
              <Button asChild>
                <Link href="/login?callbackUrl=/account/delete">
                  Sign in to delete your account
                </Link>
              </Button>
            </div>
          )}
        </section>

        <p className="text-muted-foreground text-sm">
          Can&apos;t sign in? Email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Hoador%20account`}
            className="text-primary font-medium"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          from the email address on your account, and we&apos;ll delete it for
          you.
        </p>
      </main>
    </div>
  );
}
