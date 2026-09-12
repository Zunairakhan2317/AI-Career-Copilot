"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { pageVariants } from "@/lib/motion";

type PageTransitionProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
};

/**
 * Page-level entrance animation. Wrap the top-level of a page with this
 * to get a subtle fade + slide-up on mount.
 *
 * @example
 *   <PageTransition>
 *     <Card>...</Card>
 *   </PageTransition>
 */
export default function PageTransition({
  children,
  className,
  ...rest
}: PageTransitionProps) {
  return (
    <motion.div
      className={className}
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      {...rest}
    >
      {children}
    </motion.div>
  );
}
