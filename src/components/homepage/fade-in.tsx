"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  scale?: boolean;
  blur?: boolean;
}

export default function FadeIn({
  children,
  className,
  delay = 0,
  duration = 800,
  scale = true,
  blur = true,
}: FadeInProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 30,
        scale: scale ? 0.95 : 1,
        filter: blur ? "blur(10px)" : "blur(0px)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      transition={{
        duration: duration / 1000,
        delay: delay / 1000,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
