import { Crown } from "lucide-react";
import type { UserRole } from "@playplay/shared";

interface UserBadgeUser {
  displayName?: string | null;
  avatarEmoji?: string | null;
  role?: UserRole | string | null;
}

interface UserBadgeProps {
  user: UserBadgeUser | null | undefined;
  fallbackName?: string;
  className?: string;
  nameClassName?: string;
  showCrown?: boolean;
}

export function UserBadge({
  user,
  fallbackName = "Someone",
  className = "",
  nameClassName = "",
  showCrown = true,
}: UserBadgeProps) {
  const emoji = user?.avatarEmoji ?? null;
  const name = user?.displayName || fallbackName;
  const isAdmin = showCrown && user?.role === "ADMIN";

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      {emoji && <span aria-hidden>{emoji}</span>}
      <span className={nameClassName}>{name}</span>
      {isAdmin && (
        <Crown
          className="h-3.5 w-3.5 shrink-0 text-primary"
          aria-label="Admin"
        />
      )}
    </span>
  );
}
