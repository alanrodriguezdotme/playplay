import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  /** Called on backdrop dismiss / Escape. */
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the panel (e.g. a wider max-width). */
  className?: string;
}

/**
 * Modal shell built on the native `<dialog>` element + `showModal()`.
 * Encapsulates the open/close ref dance and the panel styling that
 * ConfirmDialog / EditProfileDialog duplicated. Corner radius + border
 * width come from theme tokens (`rounded-box`, `border-theme`).
 */
export function Dialog({ open, onClose, children, className = "" }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  const composed = [
    "fixed inset-0 z-50 m-auto w-[min(24rem,calc(100vw-2rem))]",
    "border-theme border-border bg-surface rounded-box p-0 shadow-xl",
    "backdrop:bg-black/50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <dialog ref={dialogRef} onCancel={onClose} className={composed}>
      {children}
    </dialog>
  );
}
