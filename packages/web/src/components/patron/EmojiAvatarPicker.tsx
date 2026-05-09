import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMOJI_DATA,
  EMOJI_CATEGORIES,
  CATEGORY_LABELS,
  type EmojiCategory,
} from "./emojiData";

interface EmojiAvatarPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiAvatarPicker({ value, onChange }: EmojiAvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>(
    EMOJI_CATEGORIES[0],
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return EMOJI_DATA.filter(
        (e) => e.emoji === q || e.keywords.some((k) => k.includes(q)),
      );
    }
    return EMOJI_DATA.filter((e) => e.category === activeCategory);
  }, [query, activeCategory]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm text-on-surface-muted">
        Pick your avatar
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-16 w-16 items-center justify-center border-1 border-border bg-surface-raised text-3xl transition-colors hover:border-primary"
      >
        {value || "❓"}
      </button>

      {open && (
        <div className="mt-2 w-full max-w-sm border border-border bg-surface-raised p-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emojis…"
            className="mb-2 block w-full border border-border bg-surface px-3 py-2 text-sm text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {!query.trim() && (
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
              {EMOJI_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={`shrink-0 px-2 py-1 text-xs font-medium capitalize transition-colors ${
                    activeCategory === c
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-muted hover:text-on-surface hover:bg-surface-alt"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}

          <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="col-span-8 py-6 text-center text-xs text-on-surface-muted">
                No matches
              </div>
            ) : (
              visible.map((e) => (
                <button
                  key={e.emoji}
                  type="button"
                  onClick={() => {
                    onChange(e.emoji);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition-colors ${
                    value === e.emoji
                      ? "bg-primary/20 ring-1 ring-primary"
                      : "hover:bg-surface-alt"
                  }`}
                >
                  {e.emoji}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
