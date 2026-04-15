"use client";

import type { ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  delay?: number;
  parallax?: boolean;
  parallaxOffset?: number;
}

export default function AnimatedSection({
  children,
  className,
  id,
  delay = 0,
  parallax = false,
  parallaxOffset = 50,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Parallax effect - moves content slower than scroll
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [parallaxOffset, -parallaxOffset],
  );

  return (
    <section ref={ref} id={id} className={cn("overflow-hidden", className)}>
      <motion.div
        initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{
          duration: 0.8,
          delay: delay / 1000,
          ease: [0.25, 0.4, 0.25, 1],
        }}
      >
        {parallax ? (
          <motion.div style={{ y }}>{children}</motion.div>
        ) : (
          children
        )}
      </motion.div>
    </section>
  );
}
