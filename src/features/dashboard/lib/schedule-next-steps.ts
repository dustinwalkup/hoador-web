/**
 * Next-step guidance matrix for UpcomingScheduleWidget entries.
 *
 * Core dimensions: role × phase × fulfillment (meet / deliver / deliver+setup).
 * Timing (today / tomorrow / upcoming) is derived separately as an urgency layer
 * and does NOT branch the matrix — it only affects the chip sub-label in the UI.
 */

import type { ScheduleEntry } from "@/features/dashboard/types";

export interface NextStepInfo {
  /** Short primary action label, e.g. "Hand off item". Single verb + object. */
  label: string;
  /** Contextual CTA label for the detail page button. */
  ctaLabel: string;
  modal: {
    title: string;
    /** Short physical/real-world steps (3–6 words each). */
    inPerson?: string[];
    /** Short platform action steps shown in the "In app" section. */
    inApp?: string[];
    /** Single confidence/reassurance sentence shown in "Good to know". */
    goodToKnow?: string;
  };
}

export type Urgency = "today" | "tomorrow" | "upcoming";

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

type MatrixKey = string;

function makeKey(
  role: string,
  phase: string,
  fulfillment: "meet" | "deliver" | "deliver_setup",
): MatrixKey {
  return `${role}|${phase}|${fulfillment}`;
}

const MATRIX: Record<MatrixKey, NextStepInfo> = {
  // ── Renter — self pickup ──────────────────────────────────────────────────
  [makeKey("renter", "pickup", "meet")]: {
    label: "Coordinate pickup",
    ctaLabel: "View rental",
    modal: {
      title: "Coordinate pickup",
      inPerson: [
        "Contact owner to confirm time & place",
        "Check any pickup instructions",
      ],
      goodToKnow: "Owner starts the rental once you have the item.",
    },
  },
  [makeKey("renter", "return", "meet")]: {
    label: "Return item",
    ctaLabel: "View rental",
    modal: {
      title: "Return item",
      inPerson: [
        "Confirm return time & location with owner",
        "Check item condition before returning",
        "Return on time to avoid late fees",
      ],
      goodToKnow: "Owner ends the rental when they receive it.",
    },
  },

  // ── Owner — self pickup ───────────────────────────────────────────────────
  [makeKey("owner", "pickup", "meet")]: {
    label: "Hand off item",
    ctaLabel: "View rental",
    modal: {
      title: "Hand off item",
      inPerson: ["Meet renter at agreed location", "Give them the item"],
      inApp: ['Tap "Start rental" to begin the rental period'],
      goodToKnow: "Rental begins when you start it.",
    },
  },
  [makeKey("owner", "return", "meet")]: {
    label: "Receive item",
    ctaLabel: "View rental",
    modal: {
      title: "Receive item",
      inPerson: [
        "Be available at the agreed location",
        "Inspect item condition when returned",
      ],
      inApp: ['Tap "End rental" to close out the rental'],
      goodToKnow: "Charges stop when you end the rental.",
    },
  },

  // ── Renter — delivery only ────────────────────────────────────────────────
  [makeKey("renter", "pickup", "deliver")]: {
    label: "Expect delivery",
    ctaLabel: "View rental",
    modal: {
      title: "Expect delivery",
      inPerson: ["Be available at your delivery address"],
      goodToKnow:
        "You don't need to go anywhere — the owner will bring the item to you.",
    },
  },

  // ── Owner — delivery only ─────────────────────────────────────────────────
  [makeKey("owner", "pickup", "deliver")]: {
    label: "Deliver item",
    ctaLabel: "View rental",
    modal: {
      title: "Deliver item",
      inPerson: [
        "Bring item to renter's delivery address",
        "Hand off the item",
      ],
      inApp: ['Tap "Start rental" to begin the rental period'],
      goodToKnow: "Rental begins when you start it.",
    },
  },

  // ── Renter — delivery + setup ─────────────────────────────────────────────
  [makeKey("renter", "pickup", "deliver_setup")]: {
    label: "Expect delivery & setup",
    ctaLabel: "View rental",
    modal: {
      title: "Expect delivery & setup",
      inPerson: ["Be available at your delivery address"],
      goodToKnow:
        "Owner handles delivery and setup — you don't need to do anything.",
    },
  },

  // ── Owner — delivery + setup ──────────────────────────────────────────────
  [makeKey("owner", "pickup", "deliver_setup")]: {
    label: "Deliver & set up item",
    ctaLabel: "View rental",
    modal: {
      title: "Deliver & set up item",
      inPerson: [
        "Bring item & all setup materials",
        "Complete setup with the renter",
      ],
      inApp: ['Tap "Start rental" once setup is complete'],
      goodToKnow: "Rental begins when you start it.",
    },
  },

  // ── Client — service ──────────────────────────────────────────────────────
  [makeKey("client", "service", "meet")]: {
    label: "Confirm appointment",
    ctaLabel: "View booking",
    modal: {
      title: "Confirm appointment",
      inPerson: [
        "Confirm time & location with your provider",
        "Prepare space or access",
      ],
      goodToKnow: "Provider updates the booking status when done.",
    },
  },

  // ── Provider — service ────────────────────────────────────────────────────
  [makeKey("provider", "service", "meet")]: {
    label: "Deliver service",
    ctaLabel: "View booking",
    modal: {
      title: "Deliver service",
      inPerson: [
        "Head to the appointment on time",
        "Complete the service as agreed",
      ],
      inApp: ["Update booking status when finished"],
    },
  },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

function getFulfillment(
  entry: ScheduleEntry,
): "meet" | "deliver" | "deliver_setup" {
  if (entry.deliveryRequested) {
    return entry.setupRequested ? "deliver_setup" : "deliver";
  }
  return "meet";
}

/**
 * Returns guidance info for a schedule entry, or null if no match exists.
 */
export function getNextStep(entry: ScheduleEntry): NextStepInfo | null {
  const phase = entry.type; // "pickup" | "return" | "service"
  const fulfillment = getFulfillment(entry);
  const key = makeKey(entry.role, phase, fulfillment);
  return MATRIX[key] ?? null;
}

/**
 * Derives urgency from calendar-day difference (no external lib required).
 */
export function getUrgency(entryDate: Date, today?: Date): Urgency {
  const base = today ?? new Date();
  const t = new Date(base);
  t.setHours(0, 0, 0, 0);
  const e = new Date(entryDate);
  e.setHours(0, 0, 0, 0);
  const diffMs = e.getTime() - t.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return "upcoming";
}

/**
 * Human-readable urgency label shown on the chip.
 * "Today" | "Tomorrow" | "Apr 15"
 */
export function formatUrgencyLabel(urgency: Urgency, date: Date): string {
  if (urgency === "today") return "Today";
  if (urgency === "tomorrow") return "Tomorrow";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const days = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return `In ${days} day${days === 1 ? "" : "s"}`;
}
