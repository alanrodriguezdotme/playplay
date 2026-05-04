import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, X } from "lucide-react";
import type { QueueEntry } from "@playplay/shared";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DraggableQueueItem({
  entry,
  onRemove,
  onPlayNow,
}: {
  entry: QueueEntry;
  onRemove: (id: string) => void;
  onPlayNow: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-4">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-on-surface-muted hover:text-on-surface active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Song info */}
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <p className="truncate text-sm font-semibold font-family-accent">
          {entry.song.title}
        </p>
        <p className="truncate text-xs text-on-surface-muted">
          {entry.song.artist} · {entry.song.album}
        </p>
        <div className="flex gap-1">
          {entry.addedBy && (
            <span className="text-xs text-on-surface-subtle">
              {entry.addedBy.avatarEmoji ? entry.addedBy.avatarEmoji + " " : ""}
              {entry.addedBy.displayName ?? "Unknown"}
            </span>
          )}
          <span className="text-xs text-on-surface-subtle">·</span>
          <span
            className={`text-xs font-semibold text-on-surface-subtle uppercase`}
          >
            {entry.voteScore > 0 ? "+" : ""}
            {entry.voteScore} votes
          </span>
        </div>
      </div>

      {/* Duration */}
      <span className="shrink-0 text-xs text-on-surface-muted pt-1">
        {formatDuration(entry.song.duration)}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => onPlayNow(entry.id)}
          className="rounded-full p-2 text-on-surface-muted hover:bg-primary/15 hover:text-primary"
          title="Play now"
        >
          <Play fill="currentColor" stroke="none" className="h-4 w-4" />
        </button>
        <button
          onClick={() => onRemove(entry.id)}
          className="rounded-full p-2 text-on-surface-muted hover:bg-destructive/15 hover:text-destructive"
          title="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
