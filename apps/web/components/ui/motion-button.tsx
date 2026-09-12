"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { tapScale } from "@/lib/motion";

/**
 * Same API as <Button> but with a motion.button underneath so it can have
 * whileTap / whileHover micro-interactions. Use this for primary CTAs and
 * interactive elements where the subtle press feedback matters.
 *
 * Falls back to <Button> if a future maintainer wants to disable motion.
 */

const motionButtonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem]",
        lg: "h-9 gap-1.5 px-2.5",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

type MotionButtonProps = HTMLMotionProps<"button"> &
  Omit<ButtonPrimitive.Props, "ref"> &
  VariantProps<typeof motionButtonVariants> & {
    /** Disable the default whileTap micro-interaction. */
    noTap?: boolean;
  };

function MotionButton({
  className,
  variant = "default",
  size = "default",
  noTap,
  ...props
}: MotionButtonProps) {
  return (
    <motion.button
      data-slot="button"
      whileTap={noTap ? undefined : tapScale}
      className={cn(motionButtonVariants({ variant, size, className }))}
      {...(props as HTMLMotionProps<"button">)}
    />
  );
}

export { MotionButton };
