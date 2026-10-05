'use client';

import { forwardRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';

const Panel = forwardRef<HTMLDivElement, { children: ReactNode; reduced: boolean }>(function Panel({ children, reduced }, ref) {
  const present = useIsPresent();
  return <motion.div ref={ref} inert={!present} aria-hidden={!present || undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .16 }} style={{ pointerEvents: present ? undefined : 'none' }}>{children}</motion.div>;
});

export default function CrossfadePanel({ scene, enabled = true, children }: { scene: string; enabled?: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  // QR, maps and operational panels remain outside animated snapshots.
  if (!enabled || reduced) return <div>{children}</div>;
  return <div className="relative"><AnimatePresence initial={false} mode="popLayout"><Panel key={scene} reduced={Boolean(reduced)}>{children}</Panel></AnimatePresence></div>;
}
