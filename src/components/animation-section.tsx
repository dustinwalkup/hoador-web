"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CUBIC_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const fadeSlideUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

interface AnimatedSectionProps {
  children: ReactNode;
  /** Delay in seconds before this section animates in */
  delay?: number;
  className?: string;
}

/**
 * Wraps a dashboard section with a subtle fade + slide-up entrance animation.
 * Uses framer-motion with viewport detection so sections animate as they scroll into view.
 */
export function AnimatedSection({
  children,
  delay = 0,
  className,
}: AnimatedSectionProps) {
  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.45,
        delay,
        ease: CUBIC_EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: CUBIC_EASE },
  },
};

interface StaggerGridProps {
  children: ReactNode;
  className?: string;
  /** Base delay before stagger starts */
  delay?: number;
}

/**
 * Wraps a grid of items so each child staggers in one after another.
 * Children must be wrapped in <StaggerItem> for the stagger effect.
 */
export function StaggerGrid({
  children,
  className,
  delay = 0,
}: StaggerGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delayChildren: delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={cn("min-w-0", className)}>
      {children}
    </motion.div>
  );
}
