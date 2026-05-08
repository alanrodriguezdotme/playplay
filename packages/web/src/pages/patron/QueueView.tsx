import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { useQueue } from "../../contexts/QueueContext";
import { NowPlayingCard } from "../../components/patron/NowPlayingCard";
import { QueueEntryCard } from "../../components/patron/QueueEntryCard";
import SectionHeader from "../../components/common/SectionHeader";
import { Button } from "../../components/common/Button";

export function QueueView() {
  const navigate = useNavigate();
  const onSwitchToSearch = () => navigate("../search");
  const { queue, nowPlaying, isLoading, error, vote, removeSong } = useQueue();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-on-surface-muted">Loading queue…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button className="mt-3" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <NowPlayingCard entry={nowPlaying} onVote={vote} />

      <SectionHeader
        title="Up Next"
        subtitle={
          queue.length > 0
            ? `${queue.length} song${queue.length > 1 ? "s" : ""}`
            : "Queue is empty"
        }
        showTopBorder
      />

      {queue.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="text-on-surface-muted">Queue is empty</p>
          <Button className="mt-3" onClick={onSwitchToSearch}>
            Add a Song
          </Button>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {queue.map((entry, i) => (
            <QueueEntryCard
              key={entry.id}
              entry={entry}
              position={i + 1}
              onVote={vote}
              onRemove={removeSong}
            />
          ))}
        </div>
      )}

      {/* Floating add button */}
      {/* <button
        onClick={onSwitchToSearch}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Add a song"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button> */}
    </div>
  );
}
