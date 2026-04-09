import { useState } from "react";

const AVATAR_EMOJIS = [
  "😀",
  "😎",
  "🤩",
  "🥳",
  "😈",
  "👻",
  "🤖",
  "👽",
  "🦄",
  "🐱",
  "🐶",
  "🐸",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🦁",
  "🐯",
  "🐮",
  "🐷",
  "🐵",
  "🐙",
  "🦋",
  "🐝",
  "🎤",
  "🎵",
  "🎶",
  "🎸",
  "🥁",
  "🎹",
  "🎺",
  "🎷",
  "🔥",
  "⭐",
  "🌈",
  "💎",
  "🍕",
  "🌮",
  "🍩",
  "🎯",
];

interface EmojiAvatarPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiAvatarPicker({ value, onChange }: EmojiAvatarPickerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm text-on-surface-muted">
        Pick your avatar
      </label>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-border bg-surface-raised text-3xl transition-colors hover:border-primary"
      >
        {value || "❓"}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-8 gap-1.5 rounded-xl border border-border bg-surface-raised p-3">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setExpanded(false);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors ${
                value === emoji
                  ? "bg-primary/20 ring-2 ring-primary"
                  : "hover:bg-surface-alt"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
