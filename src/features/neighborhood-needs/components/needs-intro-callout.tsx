"use client";

import { useSyncExternalStore } from "react";
import { HandHelping, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "needs-intro-dismissed";

let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

// On the server (and during hydration) treat it as dismissed so nothing renders
// and there's no flash before the client reads the stored preference.
function getServerSnapshot() {
  return true;
}

function dismissIntro() {
  localStorage.setItem(STORAGE_KEY, "1");
  listeners.forEach((l) => l());
}

/**
 * Brief, dismissible explainer of what a "neighborhood need" is. Educates
 * first-time visitors on the browse feed and the post form; dismissal is
 * remembered in localStorage (shared across both surfaces) so it stays out of
 * the way once the concept is understood.
 */
export function NeedsIntroCallout({
  context = "browse",
}: {
  /** Tailors the closing call-to-action to the surface it's shown on. */
  context?: "browse" | "post";
}) {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (dismissed) return null;

  return (
    <Alert className="mb-6 pr-10">
      <HandHelping />
      <AlertTitle>New here? What a neighborhood need is</AlertTitle>
      <AlertDescription>
        A neighborhood need is a public request to borrow an item or hire a
        local service from neighbors nearby.{" "}
        {context === "post"
          ? "Post yours and neighbors who can help will reach out."
          : "See one you can help with? Open it and reach out."}
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 h-6 w-6"
        onClick={dismissIntro}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
