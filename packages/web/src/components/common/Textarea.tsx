import { forwardRef, type TextareaHTMLAttributes } from "react";
import {
  fieldBaseClasses,
  fieldSizeClasses,
  fieldToneClasses,
  type FieldSize,
  type FieldTone,
} from "./Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: FieldTone;
  inputSize?: FieldSize;
}

/**
 * Multi-line text field — shares chrome with {@link Input} (including
 * the token-gated depth effect). `noise` is unsupported for the same
 * form-control reason noted on Input.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { tone = "surface", inputSize = "md", className = "", ...rest },
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

    return <textarea ref={ref} className={composed} {...rest} />;
  },
);
