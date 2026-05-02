import { useNavigate } from "react-router";
import { useQueue } from "../../contexts/QueueContext";
import { NowPlayingCard } from "../../components/patron/NowPlayingCard";
import { QueueEntryCard } from "../../components/patron/QueueEntryCard";
import SectionHeader from "../../components/common/SectionHeader";

export function QueueView() {
  const navigate = useNavigate();
  const onSwitchToSearch = () => navigate("../search");
  const { queue, nowPlaying, isLoading, error, vote } = useQueue();

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
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
          >
            Retry
          </button>
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
          queue.length > 0 ? `${queue.length} song(s)` : "Queue is empty"
        }
      />

      {queue.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="text-on-surface-muted">Queue is empty</p>
          <button
            onClick={onSwitchToSearch}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-on-primary"
          >
            Add a Song
          </button>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {queue.map((entry, i) => (
            <QueueEntryCard
              key={entry.id}
              entry={entry}
              position={i + 1}
              onVote={vote}
            />
          ))}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={onSwitchToSearch}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Add a song"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
