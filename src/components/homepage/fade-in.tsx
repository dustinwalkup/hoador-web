"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type FadeDirection = "up" | "left" | "right";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  /** Delay before animation starts, in milliseconds */
  delay?: number;
  /** Animation duration in milliseconds (ignored when `spring` is true) */
  duration?: number;
  scale?: boolean;
  blur?: boolean;
  /** Entry direction: vertical rise, or horizontal from left/right */
  direction?: FadeDirection;
  /** Render as `span` for inline title fragments */
  asSpan?: boolean;
  /** Use a spring transition instead of eased timing */
  spring?: boolean;
}

/**
 * Fades content in with optional directional slide, blur, and scale.
 *
 * @param props - Animation and layout options
 * @returns A motion wrapper around `children`
 */
export default function FadeIn({
  children,
  className,
  delay = 0,
  duration = 800,
  scale = true,
  blur = true,
  direction = "up",
  asSpan = false,
  spring = false,
}: FadeInProps) {
  const xOffset =
    direction === "left" ? -60 : direction === "right" ? 60 : 0;
  const yOffset = direction === "up" ? 30 : 0;

  const initial = {
    opacity: 0,
    x: xOffset,
    y: yOffset,
    scale: scale ? 0.95 : 1,
    filter: blur ? "blur(10px)" : "blur(0px)",
  };

  const animate = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  };

  const transition = spring
    ? {
        type: "spring" as const,
        stiffness: 320,
        damping: 26,
        delay: delay / 1000,
      }
    : {
        duration: duration / 1000,
        delay: delay / 1000,
        ease: [0.25, 0.4, 0.25, 1] as const,
      };

  const MotionComponent = asSpan ? motion.span : motion.div;

  return (
    <MotionComponent
      initial={initial}
      animate={animate}
      transition={transition}
      className={cn(className)}
    >
      {children}
    </MotionComponent>
  );
}
