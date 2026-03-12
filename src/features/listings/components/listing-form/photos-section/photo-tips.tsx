import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RectangleHorizontal, Focus, Maximize2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const MAX_IMAGES = 10;

const PHOTO_TIPS = [
  {
    icon: RectangleHorizontal,
    label: "Horizontal",
    tip: "Horizontal images look best in search results",
  },
  {
    icon: Focus,
    label: "Centered",
    tip: "Center your subject in the frame",
  },
  {
    icon: Maximize2,
    label: "Hi-Res",
    tip: "Use the highest resolution available",
  },
] as const;

export function PhotoTips({ imageCount }: { imageCount: number }) {
  const [tipIndex, setTipIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (imageCount === 0 || imageCount >= MAX_IMAGES || isPaused) return;

    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % PHOTO_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [imageCount, isPaused]);

  if (imageCount >= MAX_IMAGES) return null;

  // Empty state: show all tips as pill badges
  if (imageCount === 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {PHOTO_TIPS.map(({ icon: Icon, label }) => (
          <Badge
            key={label}
            variant="outline"
            className="text-muted-foreground gap-1.5 text-xs font-normal"
          >
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        ))}
      </div>
    );
  }

  // Has photos: single cycling tip
  const { tip } = PHOTO_TIPS[tipIndex];
  return (
    <div
      className="relative h-5 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="text-muted-foreground absolute inset-0 flex items-center gap-1.5 text-xs"
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          {tip}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
