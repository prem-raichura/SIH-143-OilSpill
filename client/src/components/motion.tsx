// Motion in one place: timings, presets and small building blocks, so every panel moves the same way.
// Uses `m` components (LazyMotion is set up in App.tsx); MotionConfig there honours "reduce motion".
import { AnimatePresence, m, type Transition, type Variants } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export { AnimatePresence, m };

export const DUR = { fast: 0.16, base: 0.22, slow: 0.32 } as const;
export const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 36, mass: 0.9 };
const T = (d: number = DUR.base): Transition => ({ duration: d, ease: EASE });

/** Ready-made enter/exit states for `m.*` elements: spread one into the props. */
export const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: T(DUR.fast) };
export const pop = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: T(DUR.fast),
};
export const slideFromLeft = { initial: { opacity: 0, x: -24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: SPRING };
export const slideFromRight = { initial: { opacity: 0, x: 28 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 28 }, transition: SPRING };
export const slideUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 10 }, transition: T() };
export const slideDown = { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: T(DUR.fast) };

/** Staggered children (lists that appear once). */
export const listStagger: Variants = { show: { transition: { staggerChildren: 0.035 } } };
export const listItem: Variants = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: T() } };

/** Height auto <-> 0 with a fade: accordions, legends, collapsible panels. Content unmounts when closed. */
export function Collapse({ open, children, className, id }: { open: boolean; children: ReactNode; className?: string; id?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="c"
          id={id}
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={T()}
          style={{ overflow: "hidden" }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Floating panel with a title bar that collapses its body (3D scene controls, space-time cube notes). */
export function CollapsiblePanel({ title, className, children, defaultOpen = true }: { title: ReactNode; className: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${className} hud${open ? "" : " collapsed"}`}>
      <button type="button" className="hud-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <b>{title}</b>
        <ChevronDown size={15} className={`caret${open ? "" : " closed"}`} aria-hidden="true" />
      </button>
      <Collapse open={open} className="hud-body">
        {children}
      </Collapse>
    </div>
  );
}
