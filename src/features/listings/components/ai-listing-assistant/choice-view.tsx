"use client";

import { motion } from "framer-motion";
import { PencilLine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      className="flex flex-col gap-3"
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
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="bg-ai-light text-ai border-ai/30 hover:bg-ai-light hover:text-ai h-auto w-full justify-start gap-3 py-4 text-left hover:brightness-95"
          onClick={onChooseAi}
          data-testid="ai-modal-choice-ai"
        >
          <Sparkles className="size-5 shrink-0" />
          <span className="flex flex-col items-start gap-0.5">
            <span className="font-semibold">Generate from Photos</span>
            <span className="text-ai/70 text-xs font-normal">
              Upload a few photos and we&apos;ll draft your listing
            </span>
          </span>
        </Button>
      </motion.div>

      <motion.div variants={fieldVariants} {...buttonInteraction}>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-auto w-full justify-start gap-3 py-4 text-left"
          onClick={onChooseManual}
          data-testid="ai-modal-choice-manual"
        >
          <PencilLine className="size-5 shrink-0" />
          <span className="flex flex-col items-start gap-0.5">
            <span className="font-semibold">Fill Out Manually</span>
            <span className="text-muted-foreground text-xs font-normal">
              Enter your listing details yourself
            </span>
          </span>
        </Button>
      </motion.div>
    </motion.div>
  );
}
