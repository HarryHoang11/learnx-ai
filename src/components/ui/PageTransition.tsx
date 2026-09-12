// ================================================================
// <PageTransition /> — Global page entrance animation
// ================================================================
// Wraps page content with the existing `.page-enter .enter-*` CSS
// animation system. Instead of manually adding `className="page-enter"`
// on every single page, this component applies it consistently
// via a single wrapper used in the (app) layout.
// ================================================================

"use client";

import { type ReactNode, useEffect, useState } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export default function PageTransition({ children, className }: PageTransitionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const baseClass = className ?? "";
  const pageClass = mounted ? "page-enter" : "";

  return (
    <div className={`page-transition-wrapper ${pageClass} ${baseClass}`.trim()}>
      {children}
    </div>
  );
}
