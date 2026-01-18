"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export const formFieldVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

interface AnimatedFormFieldProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedFormField({
  children,
  className,
  delay = 0,
}: AnimatedFormFieldProps) {
  return (
    <motion.div
      variants={formFieldVariants}
      initial="hidden"
      animate="visible"
      transition={{
        delay: delay / 1000,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedButtonProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

export function AnimatedButton({
  children,
  className,
  disabled = false,
  type = "button",
  onClick,
}: AnimatedButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.button>
  );
}

interface AnimatedInputWrapperProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedInputWrapper({
  children,
  className,
}: AnimatedInputWrapperProps) {
  return (
    <motion.div
      className={cn(className)}
      whileFocus={{
        scale: 1.01,
        transition: { duration: 0.2 },
      }}
    >
      {children}
    </motion.div>
  );
}
