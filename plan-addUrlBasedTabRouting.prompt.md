## Plan: Add URL-based Tab Routing

Replace `useState`-based tab management in `PatronLayout` and `AdminLayout` with React Router nested routes so each tab has its own URL, enabling browser back/forward navigation and deep-linking.

### Target URL Structure

**Patron:**
| URL | View |
|---|---|
| `/venue/:slug` | Redirects → `/venue/:slug/queue` |
| `/venue/:slug/queue` | QueueView |
| `/venue/:slug/search` | SearchView |
| `/venue/:slug/history` | HistoryView |

**Admin:**
| URL | View |
|---|---|
| `/venue/:slug/admin` | Redirects → `/venue/:slug/admin/dashboard` |
| `/venue/:slug/admin/dashboard` | DashboardView |
| `/venue/:slug/admin/queue` | QueueManagement |
| `/venue/:slug/admin/music` | MusicLibrary |
| `/venue/:slug/admin/users` | UserManagement |
| `/venue/:slug/admin/settings` | SettingsView |

### Steps

**Phase 1 — Route Structure** ([App.tsx](packages/web/src/App.tsx))
1. Convert the flat `/venue/:slug` route to a parent with nested child routes (`queue`, `search`, `history`) and an index `<Navigate to="queue" replace />`
2. Convert the flat `/venue/:slug/admin` route to a parent with nested child routes (`dashboard`, `queue`, `music`, `users`, `settings`) and an index `<Navigate to="dashboard" replace />`

**Phase 2 — Patron Layout** ([PatronLayout.tsx](packages/web/src/pages/patron/PatronLayout.tsx))
3. Remove `useState<Tab>` and the `renderTab()` switch — replace tab content area with `<Outlet />`
4. Derive `activeTab` from URL using `useLocation()` (parse last path segment) for highlighting the active nav item
5. Update `BottomNav` to use `<Link>` or `useNavigate` for tab navigation instead of `onClick → setActiveTab`
6. Remove `onTabSwitch` prop from `TopBar` if unused

**Phase 3 — Admin Layout** ([AdminLayout.tsx](packages/web/src/pages/admin/AdminLayout.tsx))
7. Same pattern as Phase 2 — remove `useState<AdminTab>`, use `<Outlet />`, derive active tab from URL
8. Update `Sidebar` and `BottomNav` to navigate via links

**Phase 4 — QueueView** ([QueueView.tsx](packages/web/src/pages/patron/QueueView.tsx))
9. Replace `onSwitchToSearch` prop with `useNavigate()` → navigate to `../search` (relative path). Remove the prop type.

### Relevant Files
- [App.tsx](packages/web/src/App.tsx) — add nested `<Route>` children with index redirects
- [PatronLayout.tsx](packages/web/src/pages/patron/PatronLayout.tsx) — replace useState tabs with `<Outlet>`, derive active tab from URL
- [AdminLayout.tsx](packages/web/src/pages/admin/AdminLayout.tsx) — same pattern
- [QueueView.tsx](packages/web/src/pages/patron/QueueView.tsx) — replace `onSwitchToSearch` callback with `useNavigate`

### Verification
1. Browser back/forward navigates between tabs
2. Page refresh stays on the current tab
3. Direct URL to a specific tab works (deep-linking)
4. QueueView "switch to search" button still navigates correctly
5. Admin sidebar + mobile bottom nav both work
6. `/venue/:slug` and `/venue/:slug/admin` redirect to their default tabs

### Decisions
- **Nested routes with `<Outlet>`** (idiomatic React Router v7) rather than syncing `useState` with URL
- **`<Navigate replace>`** for index routes so redirects don't pollute history
- **Derive active tab from URL** path segment — no duplicate state
- **Relative navigation** (`../search`) in child components so they don't need full path knowledge
