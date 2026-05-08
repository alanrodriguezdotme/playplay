import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      className="fixed inset-0 z-50 m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        <p className="text-sm text-on-surface-muted">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-on-surface-muted hover:text-on-surface transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              variant === "destructive"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary text-on-primary hover:bg-primary-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
