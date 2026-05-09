import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { QueueEntry } from "@playplay/shared";
import { useAuth } from "../../contexts/AuthContext";
import { VoteButtons } from "./VoteButtons";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { UserBadge } from "../common/UserBadge";

interface QueueEntryCardProps {
  entry: QueueEntry;
  position: number;
  onVote: (entryId: string, value: 1 | -1 | 0) => void;
  onRemove?: (entryId: string) => void;
}

export function QueueEntryCard({
  entry,
  position,
  onVote,
  onRemove,
}: QueueEntryCardProps) {
  const { user } = useAuth();
  const isOwnEntry = user && entry.addedBy?.id === user.id;
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      await onRemove(entry.id);
    } finally {
      setIsRemoving(false);
      setShowRemoveConfirm(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove from Queue"
        message={`Remove "${entry.song.title}" by ${entry.song.artist} from the queue?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
        onCancel={() => setShowRemoveConfirm(false)}
      />
      <div className="flex items-center gap-3 px-4 py-4">
        {/* <span className="w-6 shrink-0 text-center text-sm font-medium text-on-surface-muted">
        {position}
      </span> */}
        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <p className="truncate text-lg text-on-surface font-family-accent">
            {entry.song.title}
          </p>
          <p className="truncate text-sm text-on-surface-muted font-semibold">
            {entry.song.artist}
          </p>
          <div className="text-sm items-center gap-1.5 mt-0.5 text-on-surface-muted">
            {entry.addedBy ? <UserBadge user={entry.addedBy} /> : null}
          </div>
        </div>
        {isOwnEntry && onRemove && (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            disabled={isRemoving}
            className="shrink-0 p-1.5 rounded-full text-on-surface-muted hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            aria-label="Remove from queue"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <VoteButtons
          voteScore={entry.voteScore}
          currentUserVote={entry.currentUserVote}
          onVote={(value) => onVote(entry.id, value)}
          size="sm"
        />
      </div>
    </>
  );
}
