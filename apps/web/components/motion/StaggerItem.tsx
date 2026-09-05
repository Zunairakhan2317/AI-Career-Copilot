"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cardVariants } from "@/lib/motion";

type StaggerItemProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
};

/**
 * Child of <StaggerContainer>. Fades and slides in when the parent enters.
 */
export default function StaggerItem({
  children,
  className,
  ...rest
}: StaggerItemProps) {
  return (
    <motion.div className={className} variants={cardVariants} {...rest}>
      {children}
    </motion.div>
  );
}
