import * as RTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import type { VerdictCode } from "../data/types";
import { labelInfo } from "../data/places";
import { VERDICT_SHORT } from "../lib/verdict";

export function ProvenanceBadges({ labels }: { labels: string[] }) {
  return (
    <span className="badge-row">
      {labels.map((l) => {
        const { text, real } = labelInfo(l);
        return (
          <span key={l} className={`badge ${real ? "badge-real" : "badge-synthetic"}`} title={real ? "Real data" : "Synthetic or simulated data"}>
            {text}
          </span>
        );
      })}
    </span>
  );
}

export function SyntheticBadge({ children = "Synthetic" }: { children?: ReactNode }) {
  return <span className="badge badge-synthetic">{children}</span>;
}

export function VerdictChip({ code, label }: { code: VerdictCode; label?: string }) {
  return (
    <span className="verdict-chip" title={`Verdict ${code}: ${label ?? VERDICT_SHORT[code]}`}>
      <span className="n">{code}</span>
      {label ?? VERDICT_SHORT[code]}
    </span>
  );
}

export function Band({ band }: { band: "High" | "Medium" | "Low" }) {
  const n = band === "High" ? 3 : band === "Medium" ? 2 : 1;
  return (
    <span className="band" aria-label={`${band} band`} title={`${band} (synthetic-calibrated band, not a probability)`}>
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
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 12, width: `${90 - i * 12}%`, marginBottom: 10 }} />
      ))}
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
export function Meter({ value, label, color = "var(--ink)" }: { value: number; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v} aria-label={label}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${v * 100}%`, background: color }} />
      </span>
    </span>
  );
}
