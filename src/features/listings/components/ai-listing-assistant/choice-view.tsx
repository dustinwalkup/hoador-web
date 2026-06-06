"use client";

import { motion } from "framer-motion";
import { PencilLine, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { containerVariants, fieldVariants } from "@/lib/animations/variants";

interface ChoiceViewProps {
  onChooseAi: () => void;
  onChooseManual: () => void;
}

const buttonInteraction = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

export function ChoiceView({ onChooseAi, onChooseManual }: ChoiceViewProps) {
  return (
    <motion.div
      className="flex flex-col gap-2 pt-2"
      data-testid="ai-modal-choice"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.p
        className="text-muted-foreground text-sm"
        variants={fieldVariants}
      >
        How would you like to create your listing?
      </motion.p>

      <motion.div variants={fieldVariants} {...buttonInteraction}>
        <button
          type="button"
          onClick={onChooseAi}
          data-testid="ai-modal-choice-ai"
          className={cn(
            "bg-ai-light text-ai border-ai/30 flex w-full items-center gap-3 rounded-lg border p-4 text-left text-sm font-medium transition-colors",
            "hover:bg-ai-light hover:text-ai hover:brightness-95",
            "focus-visible:ring-ai/40 focus-visible:ring-[3px] focus-visible:outline-none",
          )}
        >
          <span className="bg-ai/10 flex size-10 shrink-0 items-center justify-center rounded-md">
            <Sparkles className="text-ai h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block font-semibold">Generate from Photos</span>
            <span className="text-ai/70 font-normal">
              Upload a few photos and we&apos;ll draft your listing
            </span>
          </span>
        </button>
      </motion.div>

      <motion.div variants={fieldVariants} {...buttonInteraction}>
        <button
          type="button"
          onClick={onChooseManual}
          data-testid="ai-modal-choice-manual"
          className={cn(
            "bg-card flex w-full items-center gap-3 rounded-lg border p-4 text-left text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none",
          )}
        >
          <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
            <PencilLine className="text-muted-foreground h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block font-semibold">Fill Out Manually</span>
            <span className="text-muted-foreground font-normal">
              Enter your listing details yourself
            </span>
          </span>
        </button>
      </motion.div>
    </motion.div>
  );
}
