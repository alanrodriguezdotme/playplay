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
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
    >
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.song.title}</p>
        <p className="truncate text-xs text-on-surface-muted">
          {entry.song.artist}
          {entry.addedBy && (
            <span>
              {" "}
              · Added by{" "}
              {entry.addedBy.avatarEmoji ? entry.addedBy.avatarEmoji + " " : ""}
              {entry.addedBy.displayName ?? "Unknown"}
            </span>
          )}
        </p>
      </div>

      {/* Vote score */}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          entry.voteScore > 0
            ? "bg-success/15 text-success"
            : entry.voteScore < 0
              ? "bg-destructive/15 text-destructive"
              : "bg-on-surface-muted/15 text-on-surface-muted"
        }`}
      >
        {entry.voteScore > 0 ? "+" : ""}
        {entry.voteScore}
      </span>

      {/* Duration */}
      <span className="shrink-0 text-xs text-on-surface-muted">
        {formatDuration(entry.song.duration)}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onPlayNow(entry.id)}
          className="rounded-md p-1.5 text-on-surface-muted hover:bg-primary/15 hover:text-primary"
          title="Play now"
        >
          <Play fill="currentColor" stroke="none" className="h-4 w-4" />
        </button>
        <button
          onClick={() => onRemove(entry.id)}
          className="rounded-md p-1.5 text-on-surface-muted hover:bg-destructive/15 hover:text-destructive"
          title="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
