import { forwardRef, type HTMLAttributes } from "react";

/** Which surface token the card paints. */
export type CardSurface = "surface" | "raised" | "alt";

const surfaceClasses: Record<CardSurface, string> = {
  surface: "bg-surface",
  raised: "bg-surface-raised",
  alt: "bg-surface-alt",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: CardSurface;
  /** Draw a themeable-width border (default true). */
  bordered?: boolean;
}

/**
 * Surface panel — the single home for the `bg-surface-* + border +
 * rounded-box` pattern that was duplicated across pages. Corner radius
 * and border width come from theme tokens, so themes control the shape.
 *
 * The depth and noise effects are carried automatically and gated by
 * the active theme (`--theme-depth` / `--theme-noise`, both 0 by
 * default) — no per-card wiring. `noise-overlay` adds `overflow:hidden`,
 * so a Card clips its content; pass a className to opt out if a card
 * must show overflow.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { surface = "raised", bordered = true, className = "", children, ...rest },
  ref,
) {
  const composed = [
    surfaceClasses[surface],
    "rounded-box depth noise-overlay",
    bordered ? "border-theme border-border" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={composed} {...rest}>
      {children}
    </div>
  );
});
