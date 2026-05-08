import { useEffect, useRef, useState } from "react";
import { Button } from "../common/Button";
import { updateProfile } from "../../api/auth";
import { ApiRequestError } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { EmojiAvatarPicker } from "../patron/EmojiAvatarPicker";

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function EditProfileDialog({ open, onClose }: EditProfileDialogProps) {
  const { user, updateUser } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState(user?.displayName ?? "");
  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatarEmoji ?? "🎤");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form to current user values whenever the dialog opens
  useEffect(() => {
    if (open) {
      setName(user?.displayName ?? "");
      setAvatarEmoji(user?.avatarEmoji ?? "🎤");
      setError("");
    }
  }, [open, user]);

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

  const trimmed = name.trim();
  const unchanged =
    trimmed === (user?.displayName ?? "") &&
    avatarEmoji === (user?.avatarEmoji ?? "");
  const disabled = saving || !trimmed || unchanged;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError("");
    setSaving(true);
    try {
      const updated = await updateProfile({
        displayName: trimmed,
        avatarEmoji,
      });
      updateUser(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Failed to save profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="fixed inset-0 z-50 m-auto w-[min(24rem,calc(100vw-2rem))] border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-on-surface">Edit profile</h2>

        {error && (
          <div className="bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <EmojiAvatarPicker value={avatarEmoji} onChange={setAvatarEmoji} />

        <label className="block">
          <span className="text-sm text-on-surface-muted">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            required
            className="mt-1 block w-full border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            rounded="none"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" rounded="none" disabled={disabled}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
