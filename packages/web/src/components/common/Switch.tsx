interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Toggle switch — extracted from FormToggle so it can be reused. The
 * track uses the `rounded-selector` theme token; the knob stays a true
 * circle. The depth effect is carried automatically and gated by the
 * active theme.
 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const track = [
    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-selector",
    "border-2 border-transparent transition-colors disabled:cursor-not-allowed",
    "disabled:opacity-50 depth",
    checked ? "bg-primary" : "bg-surface-alt",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={track}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
