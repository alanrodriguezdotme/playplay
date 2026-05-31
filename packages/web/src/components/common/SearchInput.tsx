import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /** When provided, a clear (X) button appears while there's a value. */
  onClear?: () => void;
  /** Classes for the relative wrapper (e.g. `flex-1`). */
  wrapperClassName?: string;
}

/**
 * Header search bar — leading magnifier icon, full-width input, and an
 * optional clear button. Consolidates the icon-positioning + input
 * markup that admin list views duplicated. Intentionally a distinct
 * control from {@link Input} (borderless top/bottom bar, not a boxed
 * field).
 */
export function SearchInput({
  value,
  onChange,
  onClear,
  wrapperClassName = "",
  className = "",
  placeholder = "Search…",
  ...rest
}: SearchInputProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-full min-h-12 w-full border-b border-t border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none ${className}`}
        {...rest}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-on-surface-muted hover:text-on-surface"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
