"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

export interface OnboardingTip {
  label: string;
  detail: string;
}

export function TipsList({ tips }: { tips: OnboardingTip[] }) {
  return (
    <ul className="list-inside list-disc space-y-1.5 text-sm">
      {tips.map((tip, i) => (
        <li key={i}>
          <strong>{tip.label}</strong> {tip.detail}
        </li>
      ))}
    </ul>
  );
}

interface OnboardingTipsFloatProps {
  tips: OnboardingTip[];
  visible: boolean;
}

export function OnboardingTipsFloat({
  tips,
  visible,
}: OnboardingTipsFloatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = typeof window !== "undefined";

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 right-0 left-0 z-50 md:left-64"
        >
          <Collapsible
            key={String(visible)}
            open={isOpen}
            onOpenChange={setIsOpen}
          >
            <CollapsibleTrigger asChild>
              <button className="border-l-primary flex w-full items-center justify-between gap-2 border-b border-l-4 bg-white px-4 py-3 text-left shadow-md md:rounded-br-lg">
                <span className="text-primary flex items-center gap-2 text-sm font-medium">
                  <HelpCircle className="size-4 shrink-0" />
                  Need help with this form?
                </span>
                <ChevronDown
                  className="text-muted-foreground size-4 shrink-0 transition-transform duration-200"
                  style={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-l-primary rounded-b-lg border-b border-l-4 bg-white px-4 py-3 shadow-md">
                <TipsList tips={tips} />
                <p className="text-muted-foreground mt-2 text-xs">
                  Info must match your ID to avoid payout delays.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
