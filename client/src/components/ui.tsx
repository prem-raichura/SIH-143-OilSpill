import * as RTooltip from "@radix-ui/react-tooltip";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { VerdictCode } from "../data/types";
import { VERDICT_SHORT } from "../lib/verdict";
import { SkeletonText } from "./loaders";

export function VerdictChip({ code, label }: { code: VerdictCode; label?: string }) {
  return (
    <span className="verdict-chip" data-v={code} title={`Verdict ${code}: ${label ?? VERDICT_SHORT[code]}`}>
      <span className="n">{code}</span>
      {label ?? VERDICT_SHORT[code]}
    </span>
  );
}

export function Band({ band }: { band: "High" | "Medium" | "Low" }) {
  const n = band === "High" ? 3 : band === "Medium" ? 2 : 1;
  return (
    <span className="band" aria-label={`${band} band`} title={`${band} (calibrated band, not a probability)`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
      <span>{band}</span>
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size,
}: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm";
}) {
  return (
    <div className={`segmented${size === "sm" ? " segmented-sm" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface TabOption<T> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  title?: string;
}

/** Tabs that switch what a region shows. Arrow keys move between tabs (roving focus). */
export function Tabs<T extends string | number>({
  value,
  options,
  onChange,
  label,
  variant = "underline",
  className,
}: {
  value: T;
  options: TabOption<T>[];
  onChange: (v: T) => void;
  label: string;
  variant?: "underline" | "pill";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let k = 1; k <= options.length; k++) {
      const j = (i + dir * k + options.length) % options.length;
      if (!options[j].disabled) {
        refs.current[j]?.focus();
        onChange(options[j].value);
        return;
      }
    }
  };
  return (
    <div className={`tabs tabs-${variant}${className ? ` ${className}` : ""}`} role="tablist" aria-label={label}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            title={o.title}
            className="tab"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.icon}
            <span>{o.label}</span>
            {o.badge != null && <span className="tab-badge num">{o.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({ icon, title, description, actions }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      {icon && <span className="page-icon" aria-hidden="true">{icon}</span>}
      <div className="page-header-text">
        <h1 className="t-page">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ value, label, tone, sub }: { value: ReactNode; label: ReactNode; tone?: "accent" | "teal" | "warn" | "past" | "future"; sub?: ReactNode }) {
  return (
    <div className={`stat-card${tone ? ` tone-${tone}` : ""}`}>
      <span className="stat-value num">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="tooltip" side={side} sideOffset={6} collisionPadding={8}>
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export function Section({ title, children, aside, id }: { title: ReactNode; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="p-section" id={id}>
      <header className="p-section-head">
        <h3 className="t-section">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Loading({ lines = 4 }: { lines?: number }) {
  return (
    <div className="loading" aria-busy="true" aria-label="Loading">
      <SkeletonText lines={lines} />
    </div>
  );
}

export function ErrorNote({ error }: { error: Error }) {
  return (
    <div className="error-note" role="alert">
      {error.message}
    </div>
  );
}

/** Horizontal meter 0..1 (e.g. rank-first share). */
export function Meter({ value, label, color = "var(--accent)" }: { value: number; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v} aria-label={label}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${v * 100}%`, background: color }} />
      </span>
    </span>
  );
}
