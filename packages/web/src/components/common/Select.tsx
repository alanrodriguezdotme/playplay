import { forwardRef, type SelectHTMLAttributes } from "react";
import {
  fieldBaseClasses,
  fieldSizeClasses,
  fieldToneClasses,
  type FieldSize,
  type FieldTone,
} from "./Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  tone?: FieldTone;
  inputSize?: FieldSize;
}

/**
 * Native select, sharing chrome with {@link Input} (including the
 * token-gated depth effect). `noise` is unsupported (form-control
 * limitation).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { tone = "surface", inputSize = "md", className = "", children, ...rest },
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

    return (
      <select ref={ref} className={composed} {...rest}>
        {children}
      </select>
    );
  },
);
