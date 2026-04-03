"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface StaggeredChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  /** Milliseconds before the first child animates (maps to `delayChildren`) */
  delay?: number;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
    scale: 0.95,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

/**
 * Staggers entrance animations for direct child `StaggeredItem` components.
 *
 * @param props - Layout, stagger timing, and optional delay before children run
 * @returns A motion container that orchestrates child variants
 */
const StaggeredChildren = React.forwardRef<
  HTMLDivElement,
  StaggeredChildrenProps
>(function StaggeredChildren(
  { children, className, staggerDelay = 0.15, delay = 100, onScroll },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      onScroll={onScroll}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay / 1000,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
});

export default StaggeredChildren;

// Wrapper for individual staggered items
export function StaggeredItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={cn(className)}>
      {children}
    </motion.div>
  );
}
