"use client";

/**
 * Shared motion variants and helpers.
 * Centralizes all framer-motion configuration so every page has consistent
 * timing and feel. Designed to be subtle & professional (150-300ms).
 */

import { useReducedMotion as useFramerReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

const EASE_OUT = "easeOut" as const;
const EASE_IN_OUT = "easeInOut" as const;

/** Page-level fade + small slide. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: EASE_IN_OUT },
  },
};

/** Parent for staggered child reveals. */
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

/** Card/list-item entry — a touch more pronounced than the page fade. */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE_OUT },
  },
};

/** Opacity-only fade — for secondary content and chat. */
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.25, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: EASE_IN_OUT },
  },
};

/** Chat message slide. Direction is set by the role prop in the page. */
export const chatMessageVariants = {
  fromRight: {
    hidden: { opacity: 0, x: 16 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.22, ease: EASE_OUT },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.15 },
    },
  },
  fromLeft: {
    hidden: { opacity: 0, x: -16 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.22, ease: EASE_OUT },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.15 },
    },
  },
};

/** Hover / tap micro-interactions. */
export const tapScale = { scale: 0.97 };
export const tapScaleSm = { scale: 0.95 };
export const hoverLift = {
  y: -2,
  transition: { duration: 0.15, ease: EASE_OUT },
};
export const hoverLiftSm = {
  y: -1,
  transition: { duration: 0.15, ease: EASE_OUT },
};
export const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.15, ease: EASE_OUT },
};

/** Smooth height auto for expand/collapse. */
export const heightAutoVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.25, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2, ease: EASE_IN_OUT },
  },
};

/**
 * Re-export of framer-motion's useReducedMotion. Use this so we can swap
 * implementations later if we want different behavior than the default.
 */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

/** A safer reduced-motion fallback for whileHover / whileTap props. */
export function safeHover(shouldReduce: boolean) {
  return shouldReduce ? undefined : hoverLift;
}

export function safeTap(shouldReduce: boolean) {
  return shouldReduce ? undefined : tapScale;
}
