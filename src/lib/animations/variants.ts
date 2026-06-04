import type { Variants } from "framer-motion";

export const AUTH_EASE = [0.25, 0.4, 0.25, 1] as const;

export const fieldVariants: Variants = {
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
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export const cardEntrance = {
  initial: {
    opacity: 0,
    y: 40,
    scale: 0.95,
    filter: "blur(10px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  transition: {
    duration: 0.8,
    ease: AUTH_EASE,
  },
} as const;

export const sceneExit = {
  opacity: 0,
  y: -20,
  filter: "blur(4px)",
  transition: {
    duration: 0.25,
    ease: "easeIn",
  },
} as const;
