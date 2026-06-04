"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cardEntrance } from "@/lib/animations/variants";
import { cn } from "@/lib/utils";

interface AnimatedAuthCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedAuthCard({
  children,
  className,
  delay = 100,
}: AnimatedAuthCardProps) {
  return (
    <motion.div
      initial={cardEntrance.initial}
      animate={cardEntrance.animate}
      transition={{
        ...cardEntrance.transition,
        delay: delay / 1000,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
