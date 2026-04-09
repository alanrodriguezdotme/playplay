interface VoteButtonsProps {
  voteScore: number;
  currentUserVote?: number | null;
  onVote: (value: 1 | -1 | 0) => void;
  size?: "sm" | "lg";
  disabled?: boolean;
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function VoteButtons({
  voteScore,
  currentUserVote,
  onVote,
  size = "sm",
  disabled = false,
}: VoteButtonsProps) {
  const isLarge = size === "lg";
  const iconSize = isLarge ? "h-6 w-6" : "h-4 w-4";
  const btnSize = isLarge ? "h-11 w-11" : "h-8 w-8";
  const textSize = isLarge ? "text-lg font-bold" : "text-sm font-semibold";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => onVote(currentUserVote === 1 ? 0 : 1)}
        disabled={disabled}
        className={`${btnSize} flex items-center justify-center rounded-full transition-colors ${
          currentUserVote === 1
            ? "bg-primary text-on-primary"
            : "text-on-surface-muted hover:bg-surface-alt hover:text-on-surface"
        } disabled:opacity-40`}
        aria-label={currentUserVote === 1 ? "Remove upvote" : "Upvote"}
      >
        <ChevronUp className={iconSize} />
      </button>
      <span className={`${textSize} tabular-nums text-on-surface`}>
        {voteScore}
      </span>
      <button
        onClick={() => onVote(currentUserVote === -1 ? 0 : -1)}
        disabled={disabled}
        className={`${btnSize} flex items-center justify-center rounded-full transition-colors ${
          currentUserVote === -1
            ? "bg-destructive text-white"
            : "text-on-surface-muted hover:bg-surface-alt hover:text-on-surface"
        } disabled:opacity-40`}
        aria-label={currentUserVote === -1 ? "Remove downvote" : "Downvote"}
      >
        <ChevronDown className={iconSize} />
      </button>
    </div>
  );
}
