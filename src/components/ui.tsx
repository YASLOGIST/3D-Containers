import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */

export function Panel({
  title,
  code,
  children,
  className,
  bodyClass,
}: {
  title: string;
  code?: string;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cn("panel-surface grain relative", className)}>
      <header className="flex items-center gap-2 border-b border-line-soft px-3 py-2">
        <span className="h-2 w-2 shrink-0 bg-amber" />
        <h2 className="stencil text-[11px] font-semibold text-ink/90">
          {title}
        </h2>
        {code && (
          <span className="ml-auto font-mono text-[10px] tracking-wider text-dim">
            {code}
          </span>
        )}
      </header>
      <div className={cn("px-3 py-3", bodyClass)}>{children}</div>
      <Corner className="left-0 top-0 -translate-x-px -translate-y-px" />
      <Corner className="right-0 top-0 translate-x-px -translate-y-px rotate-90" />
      <Corner className="bottom-0 right-0 translate-x-px translate-y-px rotate-180" />
      <Corner className="bottom-0 left-0 -translate-x-px translate-y-px -rotate-90" />
    </section>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className={cn(
        "pointer-events-none absolute h-2.5 w-2.5 text-amber/50",
        className,
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path d="M0 6V0h6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export function Btn({
  children,
  onClick,
  active,
  disabled,
  title,
  className,
  tone = "neutral",
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
  tone?: "neutral" | "amber" | "ghost";
  /** set when the button toggles a persistent on/off selection */
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "group relative inline-flex items-center justify-center gap-1.5 border px-2.5 py-1.5",
        "font-mono text-[10.5px] uppercase tracking-[0.14em] transition-all duration-200",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-amber/70",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-mute",
        tone === "ghost"
          ? "border-transparent text-mute hover:text-ink"
          : active
            ? "border-amber/70 bg-amber/15 text-amber shadow-[0_0_18px_-6px_rgba(255,176,32,0.8)]"
            : "border-line bg-raise/60 text-mute hover:border-amber/40 hover:bg-raise hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex border border-line bg-void/60 p-0.5", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
            value === o.value
              ? "bg-amber/90 text-void shadow-[0_0_14px_-4px_rgba(255,176,32,0.9)]"
              : "text-dim hover:bg-raise hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className="group flex w-full items-center gap-2.5 rounded-sm py-[5px] text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-amber/70"
    >
      <span
        className={cn(
          "relative h-[14px] w-[26px] shrink-0 border transition-colors duration-200",
          value ? "border-amber/70 bg-amber/25" : "border-line bg-void",
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] h-[10px] w-[10px] transition-all duration-200",
            value
              ? "left-[13px] bg-amber shadow-[0_0_8px_rgba(255,176,32,0.9)]"
              : "left-[1px] bg-dim group-hover:bg-mute",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors",
            value ? "text-ink" : "text-mute group-hover:text-ink",
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="block truncate text-[10px] text-dim">{hint}</span>
        )}
      </span>
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block select-none py-[3px]">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-amber">
          {display}
        </span>
      </span>
      <span className="relative mt-1 block h-[3px] w-full bg-line">
        <span
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-deep to-amber"
          style={{ width: `${pct}%` }}
        />
      </span>
      <input
        type="range"
        className="range-uld -mt-[11px] block w-full"
        aria-label={label}
        aria-valuetext={display}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function Row({
  k,
  v,
  tone = "ink",
}: {
  k: string;
  v: ReactNode;
  tone?: "ink" | "amber" | "steel" | "mute";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft/70 py-[5px] last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
        {k}
      </span>
      <span
        className={cn(
          "font-mono text-[11.5px] tabular-nums",
          tone === "amber" && "text-amber",
          tone === "steel" && "text-steel",
          tone === "mute" && "text-mute",
          tone === "ink" && "text-ink",
        )}
      >
        {v}
      </span>
    </div>
  );
}

export function Chip({
  children,
  tone = "line",
}: {
  children: ReactNode;
  tone?: "line" | "amber" | "steel";
}) {
  return (
    <span
      className={cn(
        "border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em]",
        tone === "amber" && "border-amber/50 bg-amber/10 text-amber",
        tone === "steel" && "border-steel/40 bg-steel/10 text-steel",
        tone === "line" && "border-line bg-void/50 text-mute",
      )}
    >
      {children}
    </span>
  );
}
