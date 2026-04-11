"use client";

import Link from "next/link";
import { Info, MapPin, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ScheduleEntry } from "@/features/dashboard/types";
import {
  formatUrgencyLabel,
  getNextStep,
  getUrgency,
} from "@/features/dashboard/lib/schedule-next-steps";

interface ScheduleEntryNextStepProps {
  entry: ScheduleEntry;
}

const chipVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function ScheduleEntryNextStep({ entry }: ScheduleEntryNextStepProps) {
  const info = getNextStep(entry);
  if (!info) return null;

  const urgency = getUrgency(entry.date);
  // Only prefix the chip with "Today" or "Tomorrow" — for upcoming the date badge
  // and formatted date below the entry are already present.
  const showUrgencyPrefix = true; // = urgency === "today" || urgency === "tomorrow";
  const urgencyLabel = showUrgencyPrefix
    ? formatUrgencyLabel(urgency, entry.date)
    : null;

  // This wrapper must live in the client component — the parent widget is a
  // Server Component and cannot hold onClick handlers. The div also provides
  // the flex-1 expansion so the chip fills available row space.
  return (
    <div
      className="min-w-0 flex-1 cursor-pointer overflow-hidden"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      <Dialog>
        <DialogTrigger asChild>
          <motion.button
            variants={chipVariants}
            initial="hidden"
            animate="visible"
            type="button"
            className="group cursor-point flex min-h-11 w-full items-center gap-1.5 overflow-hidden rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-left transition-colors hover:border-teal-300 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/30 dark:hover:border-teal-700 dark:hover:bg-teal-950/50"
          >
            {urgencyLabel && (
              <>
                <span className="shrink-0 text-[10px] font-semibold tracking-wide text-teal-600 uppercase dark:text-teal-400">
                  {urgencyLabel}
                </span>
                <span
                  className="text-[10px] text-teal-600/40 dark:text-teal-400/40"
                  aria-hidden
                >
                  ·
                </span>
              </>
            )}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-teal-700 dark:text-teal-300">
              {info.label}
            </span>
            <Info
              className="size-5 shrink-0 text-teal-500 opacity-50 transition-opacity group-hover:opacity-100 dark:text-teal-400"
              aria-hidden
            />
          </motion.button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{info.modal.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Guidance for your upcoming {entry.type}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* In person */}
            {info.modal.inPerson && info.modal.inPerson.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin
                    className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  <span className="text-sm font-semibold">In person</span>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {info.modal.inPerson.map((step) => (
                    <li
                      key={step}
                      className="text-muted-foreground flex items-start gap-2 text-sm"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                        aria-hidden
                      />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* In app */}
            {info.modal.inApp && info.modal.inApp.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone
                    className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  <span className="text-sm font-semibold">In app</span>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {info.modal.inApp.map((step) => (
                    <li
                      key={step}
                      className="text-muted-foreground flex items-start gap-2 text-sm"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
                        aria-hidden
                      />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Good to know */}
            {info.modal.goodToKnow && (
              <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 dark:border-teal-800 dark:bg-teal-950/30">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400"
                  aria-hidden
                />
                <p className="text-sm text-teal-800 dark:text-teal-300">
                  {info.modal.goodToKnow}
                </p>
              </div>
            )}

            {/* CTA */}
            {entry.linkTo && (
              <DialogClose asChild>
                <Button asChild className="w-full">
                  <Link href={entry.linkTo}>{info.ctaLabel}</Link>
                </Button>
              </DialogClose>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
