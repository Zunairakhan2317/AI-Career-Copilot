"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { containerVariants } from "@/lib/motion";

type StaggerContainerProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
};

/**
 * Container that staggers the entrance of its <StaggerItem> children.
 *
 * @example
 *   <StaggerContainer>
 *     <StaggerItem><Card>One</Card></StaggerItem>
 *     <StaggerItem><Card>Two</Card></StaggerItem>
 *   </StaggerContainer>
 */
export default function StaggerContainer({
  children,
  className,
  ...rest
}: StaggerContainerProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}
