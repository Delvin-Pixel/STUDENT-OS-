/* STUDENT OS — "Daybreak Workspace" shell.
   Desktop: persistent warm sidebar with icon+label nav. Mobile: coral-accented
   bottom tab bar (Home / Study / Tasks / Focus / More). "More" opens a sheet
   with the remaining sections. */

import { useAuth } from "@/_core/hooks/useAuth";
import QuickAdd from "@/components/QuickAdd";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useStore } from "@/contexts/StoreContext";
import { profilePhotoStorageKey } from "@/lib/privateAssets";
import { getGlobalSearchResults } from "@/lib/search";
import { trpc } from "@/lib/trpc";
import { cn, levelForXp, streakLabel } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  BookOpenText,
  Bot,
  Brain,
  BrainCircuit,
  CalendarDays,
  CheckSquare,
  Cloud,
  CloudOff,
  Compass,
  FileSearch,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";

const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/study", label: "Study", icon: BookOpen },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/focus", label: "Focus", icon: Timer },
  { path: "/flashcards", label: "Flashcards", icon: Brain },
  { path: "/mastery", label: "Mastery", icon: Sparkles },
  { path: "/ai-quiz", label: "AI Quiz", icon: BrainCircuit },
  { path: "/materials", label: "Materials", icon: FileText },
  { path: "/reviews", label: "Reviews", icon: CalendarDays },
  { path: "/material-summary", label: "PDF summary", icon: FileSearch },
  { path: "/today", label: "Today", icon: CalendarDays },
  { path: "/journey", label: "Journey", icon: Compass },
  { path: "/foundation", label: "Foundation", icon: Brain },
  { path: "/notes", label: "Notes", icon: BookOpenText },
  { path: "/saved", label: "Saved lessons", icon: BookMarked },
  { path: "/timetable", label: "Timetable", icon: CalendarDays },
  { path: "/exams", label: "Exams", icon: FileText },
  { path: "/progress", label: "Progress", icon: BarChart3 },
  { path: "/goals", label: "Goals", icon: Target },
  { path: "/budget", label: "Budget", icon: Wallet },
  { path: "/assistant", label: "Assistant", icon: Bot },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/feedback", label: "AI feedback", icon: MessageSquareHeart },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_TABS = [
  { path: "/", label: "Home", icon: LayoutDashboard },
  { path: "/study", label: "Study", icon: BookOpen },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/focus", label: "Focus", icon: Timer },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const {
    state,
    syncStatus,
    recoveryRequired,
    syncConflictAvailable,
    resolveWorkspaceConflict,
  } = useStore();
  const { logout } = useAuth();
  const photoStorageKey = profilePhotoStorageKey(state.profile);
  const profilePhoto = trpc.profilePhoto.accessUrl.useQuery(
    { storageKey: photoStorageKey ?? "unavailable" },
    {
      enabled: Boolean(photoStorageKey),
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 0,
    }
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const level = levelForXp(state.xp);
  const unread = state.notifications.filter(n => !n.read).length;
  const syncInfo = {
    synced: { label: "Synced", icon: Cloud },
    syncing: { label: "Syncing…", icon: RefreshCw },
    offline: { label: "Offline · changes saved here", icon: CloudOff },
    pending: { label: "Changes pending", icon: RefreshCw },
    conflict: { label: "Review cloud changes", icon: AlertTriangle },
    failed: { label: "Sync will retry", icon: AlertTriangle },
    storage_error: { label: "Local save needs attention", icon: AlertTriangle },
    recovery_required: { label: "Recovery needed", icon: AlertTriangle },
    loading: { label: "Loading workspace…", icon: RefreshCw },
  }[syncStatus];
  const SyncIcon = syncInfo.icon;

  const NavItem = ({
    item,
    compact,
  }: {
    item: (typeof NAV)[number];
    compact?: boolean;
  }) => {
    const active = location === item.path;
    return (
      <Link
        href={item.path}
        onClick={() => setMoreOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            active && "text-primary-foreground"
          )}
        />
        {!compact && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <img src="/logo.svg" alt="Student OS" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">
              Student <span className="text-primary">OS</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Your life. In one place.
            </div>
          </div>
        </Link>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(item => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* XP ring */}
        <div className="mt-auto rounded-2xl bg-sidebar-accent/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-primary" />
            <span>{streakLabel(state.streakDays)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Lv {level.current.level} · {level.current.name}
            </span>
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" /> {state.xp} XP
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-8">
        {/* top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:px-8">
          <span className="flex items-center gap-2 font-display text-lg font-bold lg:hidden">
            <img src="/logo.svg" alt="" className="h-7 w-7" />
            Student <span className="text-primary">OS</span>
          </span>
          <div className="flex-1" />
          <span
            className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
            title={syncInfo.label}
          >
            <SyncIcon
              className={cn(
                "h-3.5 w-3.5",
                syncStatus === "syncing" && "animate-spin",
                ["conflict", "failed", "storage_error"].includes(syncStatus) &&
                  "text-amber-600"
              )}
            />
            {syncInfo.label}
          </span>
          {state.profile?.name && (
            <div
              className="flex items-center gap-2"
              aria-label={`${state.profile.name}'s profile`}
            >
              <span className="hidden text-sm text-muted-foreground md:block">
                {state.profile.name}
              </span>
              <Avatar className="h-8 w-8 border border-primary/15">
                <AvatarImage src={profilePhoto.data?.url} alt="" />
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {state.profile.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowSearch(true)}
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            asChild
          >
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="h-4.5 w-4.5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => void logout()}
            aria-label="Sign out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </header>

        {syncConflictAvailable && (
          <section
            role="alert"
            className="mx-4 mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100 lg:mx-8"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">
                  Some changes were made on another device.
                </p>
                <p className="text-sm opacity-80">
                  Your device changes are safely preserved. Choose how to
                  resolve the conflict.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void resolveWorkspaceConflict("cloud")}
                >
                  Keep cloud
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void resolveWorkspaceConflict("local")}
                >
                  Keep mine
                </Button>
                <Button
                  size="sm"
                  onClick={() => void resolveWorkspaceConflict("merge")}
                >
                  Combine changes
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* page content */}
        <main className="page-in flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pt-6">
          {recoveryRequired && (
            <div
              role="alert"
              className="mx-auto mb-4 max-w-3xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <p className="font-semibold">
                We could not read this device’s local workspace.
              </p>
              <p className="mt-1">
                Your cloud data has not been deleted. Reconnect to the internet
                and use Refresh from Settings to recover it before continuing.
              </p>
            </div>
          )}
          {children}
        </main>
        <QuickAdd />
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-lg lg:hidden">
        <div className="grid grid-cols-5 items-center">
          {MOBILE_TABS.map(t => {
            const active = location === t.path;
            return (
              <Link
                key={t.path}
                href={t.path}
                className="flex flex-col items-center gap-0.5 py-2"
              >
                <t.icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2"
            aria-label="More"
          >
            <MoreIcon active={false} />
            <span className="text-[10px] font-medium text-muted-foreground">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── More sheet (mobile) ─────────────────────────────── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] overflow-y-auto rounded-t-3xl pb-10"
        >
          <SheetHeader className="pb-1">
            <SheetTitle className="font-display text-left text-lg">
              More
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-2">
            {NAV.filter(n => !MOBILE_TABS.some(m => m.path === n.path)).map(
              item => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border border-border p-4 text-center transition-colors",
                    location === item.path
                      ? "bg-primary/10"
                      : "bg-card hover:bg-accent"
                  )}
                >
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              )
            )}
          </div>
        </SheetContent>
      </Sheet>

      <GlobalSearch open={showSearch} onOpenChange={setShowSearch} />
    </div>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <Menu
      className={cn(
        "h-5 w-5",
        active ? "text-primary" : "text-muted-foreground"
      )}
    />
  );
}

/* ── Global search: tasks, subjects, flashcards, goals, exams, sessions ─── */

function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const results = getGlobalSearchResults(state, query);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-background/95 p-0 backdrop-blur-sm"
        onOpenAutoFocus={event => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, flashcards, goals…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto p-4">
          {!q ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Search across your tasks, notes, flashcards, goals, exams and
              study sessions.
            </p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No results for “{query}”.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <Link
                  key={i}
                  href={r.route}
                  className="rounded-xl border border-border bg-card p-3"
                  onClick={() => onOpenChange(false)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {r.kind}
                    </Badge>
                    <span className="truncate text-sm font-medium">
                      {r.title}
                    </span>
                  </div>
                  {r.sub && (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {r.sub}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
