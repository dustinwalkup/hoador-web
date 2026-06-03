import { PencilLine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChoiceViewProps {
  onChooseAi: () => void;
  onChooseManual: () => void;
}

export function ChoiceView({ onChooseAi, onChooseManual }: ChoiceViewProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="ai-modal-choice">
      <p className="text-muted-foreground text-sm">
        How would you like to create your listing?
      </p>

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="bg-ai-light text-ai border-ai/30 hover:bg-ai-light hover:text-ai hover:brightness-95 h-auto justify-start gap-3 py-4 text-left"
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

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-auto justify-start gap-3 py-4 text-left"
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
    </div>
  );
}
