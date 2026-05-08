import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { UserBadge } from "../../components/common/UserBadge";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useDebounce } from "../../hooks/useDebounce";
import { getUsers, updateUser } from "../../api/admin";
import type { AdminUser, UserRole } from "@playplay/shared";
import { timeAgo } from "../../utils/time";

type Filter = "all" | "PATRON" | "ADMIN" | "blocked";

export function UserManagement() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const debouncedQuery = useDebounce(query, 300);
  const [blockConfirm, setBlockConfirm] = useState<AdminUser | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(
    async (p: number, append = false) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(p),
          limit: "50",
        };
        if (debouncedQuery) params.search = debouncedQuery;
        if (filter === "PATRON" || filter === "ADMIN") params.role = filter;
        if (filter === "blocked") params.blocked = "true";

        const data = await getUsers(params);
        setUsers((prev) => (append ? [...prev, ...data.users] : data.users));
        setTotal(data.total);
        setPage(p);
      } catch {
        showToast("Failed to load users", "error");
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, filter, showToast],
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleToggleBlock = async (user: AdminUser) => {
    // Blocking requires confirmation; unblocking does not
    if (!user.blocked) {
      setBlockConfirm(user);
      return;
    }
    await executeToggleBlock(user);
  };

  const executeToggleBlock = async (user: AdminUser) => {
    try {
      const updated = await updateUser(user.id, { blocked: !user.blocked });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      showToast(
        updated.blocked
          ? `Blocked ${user.displayName || user.deviceId?.slice(0, 8) || "user"}`
          : `Unblocked ${user.displayName || user.deviceId?.slice(0, 8) || "user"}`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update user",
        "error",
      );
    } finally {
      setBlockConfirm(null);
    }
  };

  const handleToggleRole = async (user: AdminUser) => {
    setRoleConfirm(user);
  };

  const executeToggleRole = async (user: AdminUser) => {
    const newRole: UserRole = user.role === "ADMIN" ? "PATRON" : "ADMIN";
    try {
      const updated = await updateUser(user.id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      showToast(
        `${user.displayName || user.deviceId?.slice(0, 8) || "User"} is now ${newRole}`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update role",
        "error",
      );
    } finally {
      setRoleConfirm(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={!!blockConfirm}
        title="Block User"
        message={`Are you sure you want to block ${blockConfirm?.displayName || blockConfirm?.deviceId?.slice(0, 8) || "this user"}? They will not be able to add songs or vote.`}
        confirmLabel="Block"
        variant="destructive"
        onConfirm={() => blockConfirm && executeToggleBlock(blockConfirm)}
        onCancel={() => setBlockConfirm(null)}
      />
      <ConfirmDialog
        open={!!roleConfirm}
        title={roleConfirm?.role === "ADMIN" ? "Demote User" : "Promote User"}
        message={`Are you sure you want to ${roleConfirm?.role === "ADMIN" ? "demote" : "promote"} ${roleConfirm?.displayName || roleConfirm?.deviceId?.slice(0, 8) || "this user"} to ${roleConfirm?.role === "ADMIN" ? "PATRON" : "ADMIN"}?`}
        confirmLabel={roleConfirm?.role === "ADMIN" ? "Demote" : "Promote"}
        onConfirm={() => roleConfirm && executeToggleRole(roleConfirm)}
        onCancel={() => setRoleConfirm(null)}
      />
      <div className="flex flex-col">
        <AdminPageHeader title="Users">
          <span className="text-sm text-on-surface-muted">{total} total</span>
        </AdminPageHeader>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full min-h-12 h-full border-b border-t border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:border-border-focus focus:outline-none"
            />
          </div>
          <div className="flex border-b sm:border border-border">
            {(["all", "PATRON", "ADMIN", "blocked"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`p-4 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-surface-alt text-primary"
                    : "text-on-surface-muted hover:text-on-surface"
                }`}
              >
                {f === "PATRON" ? "Patrons" : f === "ADMIN" ? "Admins" : f}
              </button>
            ))}
          </div>
        </div>

        {/* User list */}
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-on-surface-muted">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
            <p className="text-on-surface-muted">
              {query ? "No users match your search" : "No users yet"}
            </p>
          </div>
        ) : (
          <>
            {/* Table header - desktop */}
            <div className="hidden md:flex items-center gap-3 p-4 text-xs font-medium text-on-surface-muted uppercase tracking-wider">
              <span className="flex-1">User</span>
              <span className="w-20 text-center">Role</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-24 text-right">Joined</span>
              <span className="w-36 text-center">Actions</span>
            </div>

            <div className="flex flex-col divide-y divide-border">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-2 p-4 ${
                      user.blocked ? "bg-surface opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <UserBadge
                          user={user}
                          nameClassName="truncate text-sm font-semibold"
                        />
                        {isSelf && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 items-center">
                        <p className="truncate text-xs text-on-surface-muted">
                          {user.phone || user.deviceId?.slice(0, 8) || "—"}
                        </p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase sm:block md:hidden ${
                            user.role === "ADMIN"
                              ? "bg-primary/15 text-primary"
                              : "bg-on-surface-muted/15 text-on-surface-muted"
                          }`}
                        >
                          {user.role}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium sm:block md:hidden uppercase ${
                            user.blocked
                              ? "bg-destructive/15 text-destructive"
                              : "bg-success/15 text-success"
                          }`}
                        >
                          {user.blocked ? "Blocked" : "Active"}
                        </span>
                      </div>
                    </div>

                    <span className="w-20 text-center hidden sm:hidden md:block">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          user.role === "ADMIN"
                            ? "bg-primary/15 text-primary"
                            : "bg-on-surface-muted/15 text-on-surface-muted"
                        }`}
                      >
                        {user.role}
                      </span>
                    </span>

                    <span className="w-20 text-center hidden sm:hidden md:block">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          user.blocked
                            ? "bg-destructive/15 text-destructive"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {user.blocked ? "Blocked" : "Active"}
                      </span>
                    </span>

                    <span className="hidden md:block w-24 text-right text-xs text-on-surface-muted">
                      {timeAgo(user.createdAt)}
                    </span>

                    <div className="flex w-36 justify-center gap-1.5">
                      <button
                        onClick={() => handleToggleRole(user)}
                        disabled={isSelf}
                        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-on-surface-muted hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
                        title={
                          isSelf
                            ? "Cannot change own role"
                            : `Make ${user.role === "ADMIN" ? "Patron" : "Admin"}`
                        }
                      >
                        {user.role === "ADMIN" ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleToggleBlock(user)}
                        disabled={isSelf}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                          user.blocked
                            ? "border border-success/30 text-success hover:bg-success/15"
                            : "border border-destructive/30 text-destructive hover:bg-destructive/15"
                        }`}
                        title={
                          isSelf
                            ? "Cannot block yourself"
                            : user.blocked
                              ? "Unblock user"
                              : "Block user"
                        }
                      >
                        {user.blocked ? "Unblock" : "Block"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {users.length < total && (
              <button
                onClick={() => fetchUsers(page + 1, true)}
                disabled={loading}
                className="w-full rounded-lg border border-border py-2.5 text-xs font-medium text-on-surface-muted hover:text-on-surface disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : `Load More (${users.length} of ${total})`}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
