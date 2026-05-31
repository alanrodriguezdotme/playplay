import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { Input } from "./Input";
import { Switch } from "./Switch";

// ---- Text / Number / URL input ----

interface FormInputProps {
  label: string;
  description?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "email" | "tel" | "url" | "password";
  placeholder?: string;
  min?: number;
  max?: number;
  compact?: boolean;
}

export function FormInput({
  label,
  description,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  compact,
}: FormInputProps) {
  return (
    <div className={compact ? "" : "p-4"}>
      <label
        className={`block ${compact ? "text-xs text-on-surface-muted" : "text-sm font-medium text-on-surface"} mb-1`}
      >
        {label}
      </label>
      {description && (
        <p className="text-xs text-on-surface-muted mb-2">{description}</p>
      )}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
      />
    </div>
  );
}

// ---- Toggle switch ----

interface FormToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}

export function FormToggle({
  label,
  description,
  checked,
  onChange,
  compact,
}: FormToggleProps) {
  return (
    <div
      className={`flex items-center justify-between ${compact ? "py-4border-t border-border" : "p-4"}`}
    >
      <div>
        <label className="block text-sm font-medium text-on-surface">
          {label}
        </label>
        {description && (
          <p className="text-xs text-on-surface-muted">{description}</p>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

// ---- Radio group ----

interface RadioOption<T extends string> {
  value: T;
  label: string;
  desc: string;
  disabled?: boolean;
}

interface FormRadioGroupProps<T extends string> {
  name: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  children?: ReactNode;
}

export function FormRadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  children,
}: FormRadioGroupProps<T>) {
  return (
    <div className="p-4 space-y-4">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex cursor-pointer items-start gap-3 border p-3 transition-colors ${
            value === opt.value
              ? "border-primary bg-primary/5"
              : "border-border"
          } ${opt.disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={opt.disabled}
            className="mt-0.5 accent-primary"
          />
          <div>
            <p className="text-sm font-medium text-on-surface">
              {opt.label}
              {opt.disabled && (
                <Badge variant="neutral" className="ml-2">
                  COMING SOON
                </Badge>
              )}
            </p>
            <p className="text-xs text-on-surface-muted">{opt.desc}</p>
          </div>
        </label>
      ))}
      {children}
    </div>
  );
}

// ---- Range slider ----

interface FormSliderProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export function FormSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue = (v) => String(v),
}: FormSliderProps) {
  return (
    <div className="p-4">
      <label className="block text-sm font-medium text-on-surface mb-1">
        {label}
      </label>
      {description && (
        <p className="text-xs text-on-surface-muted mb-2">{description}</p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary"
      />
      <p className="mt-1 text-xs tabular-nums text-on-surface-muted">
        {formatValue(value)}
      </p>
    </div>
  );
}
