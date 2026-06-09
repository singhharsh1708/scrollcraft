"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface ScrollSectionProps {
  children: React.ReactNode | ((inView: boolean) => React.ReactNode);
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  delay?: number;
}

export default function ScrollSection({ children, className, style, onClick, delay = 0 }: ScrollSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-15% 0px -15% 0px" });

  if (typeof children === "function") {
    return (
      <div ref={ref} className={className} style={style} onClick={onClick}>
        {children(inView)}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      onClick={onClick}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay }}
    >
      {children}
    </motion.div>
  );
}
