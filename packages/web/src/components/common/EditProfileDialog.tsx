import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { updateProfile } from "../../api/auth";
import { ApiRequestError } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { EmojiAvatarPicker } from "../patron/EmojiAvatarPicker";
import { validateUsername } from "@playplay/shared";

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function EditProfileDialog({ open, onClose }: EditProfileDialogProps) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

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

  const trimmed = name.trim();
  const unchanged =
    trimmed === (user?.displayName ?? "") &&
    avatarEmoji === (user?.avatarEmoji ?? "");
  const disabled = saving || !trimmed || unchanged;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError("");

    const nameCheck = validateUsername(name);
    if (!nameCheck.ok) {
      showToast(nameCheck.reason, "error");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        displayName: nameCheck.value,
        avatarEmoji,
      });
      updateUser(updated);
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : "Failed to save profile";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
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
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            required
            tone="raised"
            inputSize="lg"
            className="mt-1"
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
    </Dialog>
  );
}
