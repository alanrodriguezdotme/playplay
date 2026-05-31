import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "destructive-soft"
  | "ghost";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export type ButtonRounded = "none" | "md" | "lg" | "full";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: ButtonRounded;
  fullWidth?: boolean;
  active?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50",
  secondary:
    "border border-border text-on-surface-muted hover:text-on-surface disabled:opacity-50",
  destructive:
    "bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50",
  "destructive-soft":
    "bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50",
  ghost:
    "text-on-surface-muted hover:text-on-surface hover:bg-surface-alt disabled:opacity-50",
};

const activeClasses: Partial<Record<ButtonVariant, string>> = {
  ghost: "bg-surface-alt text-primary hover:text-primary",
  secondary: "bg-primary text-on-primary border-primary hover:text-on-primary",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-3 py-1.5 text-xs font-medium",
  sm: "px-3 py-2 text-xs font-medium",
  md: "px-4 py-2 text-sm font-medium",
  lg: "px-4 py-3 text-sm font-medium",
  icon: "p-2",
};

// Mapped to theme shape tokens so themes control corner radius. The
// token defaults match the previous literal values, so existing usage
// looks identical until a theme changes them.
const roundedClasses: Record<ButtonRounded, string> = {
  none: "",
  md: "rounded-field",
  lg: "rounded-box",
  full: "rounded-selector",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      rounded = "none",
      fullWidth = false,
      active = false,
      leftIcon,
      rightIcon,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    // `depth` is carried automatically and gated by the active theme
    // (invisible while --theme-depth is 0).
    const base =
      "inline-flex items-center justify-center gap-1.5 depth transition-colors disabled:cursor-not-allowed";
    const variantCls =
      active && activeClasses[variant]
        ? activeClasses[variant]
        : variantClasses[variant];
    const composed = [
      base,
      variantCls,
      sizeClasses[size],
      roundedClasses[rounded],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} type={type} className={composed} {...rest}>
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);
