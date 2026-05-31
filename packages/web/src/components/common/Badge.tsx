import { type HTMLAttributes, type ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "destructive"
  | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-alt text-on-surface-muted",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

/**
 * Small pill / tag — replaces the inline
 * `rounded bg-surface-alt px-1.5 py-0.5 text-[10px]` pattern. Uses the
 * `rounded-selector` theme token so themes control its corner radius.
 * The noise effect is carried automatically and gated by the active
 * theme (`--theme-noise`, 0 by default).
 */
export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  const composed = [
    "inline-flex items-center rounded-selector px-1.5 py-0.5",
    "text-[10px] font-semibold uppercase tracking-wide noise-overlay",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={composed} {...rest}>
      {children}
    </span>
  );
}
