"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
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
      initial={{
        opacity: 0,
        y: 40,
        scale: 0.95,
        filter: "blur(10px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      transition={{
        duration: 0.8,
        delay: delay / 1000,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
