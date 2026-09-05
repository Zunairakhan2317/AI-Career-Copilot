"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift, tapScale } from "@/lib/motion";

/**
 * <MotionCard> — drop-in for <Card> on cards that should lift on hover and
 * press on tap. Stays opt-in so list views don't get unwanted interactivity.
 */
type MotionCardProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
  size?: "default" | "sm";
  interactive?: boolean;
};

function MotionCard({
  className,
  size = "default",
  interactive = true,
  children,
  ...props
}: MotionCardProps) {
  return (
    <motion.div
      data-slot="card"
      data-size={size}
      whileHover={interactive ? hoverLift : undefined}
      whileTap={interactive ? tapScale : undefined}
      className={cn(
        "flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 px-4 text-sm text-card-foreground ring-1 ring-foreground/10 transition-shadow",
        interactive && "cursor-pointer hover:shadow-lg hover:shadow-foreground/5",
        size === "sm" && "gap-3",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { MotionCard };
