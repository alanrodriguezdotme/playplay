import { forwardRef, type InputHTMLAttributes } from "react";

/** Background token the field paints — pick the one that reads as
 *  inset against its surrounding surface. */
export type FieldTone = "surface" | "raised" | "alt";

/** Field density. `md` is the default form field; `lg` is the taller,
 *  larger-text treatment used on auth screens. */
export type FieldSize = "md" | "lg";

export const fieldToneClasses: Record<FieldTone, string> = {
  surface: "bg-surface",
  raised: "bg-surface-raised",
  alt: "bg-surface-alt",
};

export const fieldSizeClasses: Record<FieldSize, string> = {
  md: "px-4 py-2.5 text-sm",
  lg: "px-4 py-3 text-base",
};

/**
 * Shared field chrome: themeable border + radius, canonical focus, and
 * the token-gated `depth` effect (invisible while `--theme-depth` is 0,
 * so the active theme alone decides whether fields look embossed).
 */
export const fieldBaseClasses =
  "w-full border-theme border-border rounded-field depth text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-ring";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  tone?: FieldTone;
  inputSize?: FieldSize;
}

/**
 * The single text-field component. Variations are expressed through
 * props (`tone`, `inputSize`) rather than per-site class strings, so
 * every field in the app stays consistent and themeable. One-off needs
 * (e.g. the centered OTP field) use the `className` escape hatch.
 *
 * Effects: `depth` is carried automatically and gated by the theme.
 * Noise is intentionally absent — the `::before` overlay it relies on
 * does not render on form-control elements; put noise on a Card.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { tone = "surface", inputSize = "md", className = "", type = "text", ...rest },
  ref,
) {
  const composed = [
    fieldBaseClasses,
    fieldToneClasses[tone],
    fieldSizeClasses[inputSize],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <input ref={ref} type={type} className={composed} {...rest} />;
});
