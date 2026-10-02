/* STUDENT OS — Quick Add command palette.
   Cmd/Ctrl+K on desktop, floating + button on mobile. Instantly adds tasks,
   study sessions, flashcards, or transactions with a single text entry. */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/contexts/StoreContext";
import {
  buildQuickAddSessionDraft,
  QUICK_ADD_SESSION_STATUS,
  type QuickAddSessionDraft,
  validQuickAddExpenseAmount,
  validQuickAddSessionDraft,
} from "@/lib/quickAddContracts";
import { nlpSummary, parseQuickAdd } from "@/lib/quickAddParse";
import { todayStr } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  Coins,
  Layers,
  ListTodo,
  Plus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Kind = "task" | "session" | "card" | "expense";

interface Parsed {
  title: string;
  amount?: number;
  subject?: string;
}

function parseAmount(raw: string): Parsed {
  const m = raw.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*[£$€]?$/);
  return { title: m ? m[1] : raw, amount: m ? parseFloat(m[2]) : undefined };
}

const KINDS: { key: Kind; label: string; icon: typeof ListTodo }[] = [
  { key: "task", label: "Task", icon: ListTodo },
  { key: "session", label: "Session", icon: BookOpen },
  { key: "card", label: "Card", icon: Layers },
  { key: "expense", label: "Expense", icon: Coins },
];

function useKeyboardShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}

export default function QuickAdd() {
  const { state, addTask, addSession, addCard, addTransaction, notify } =
    useStore();
  const [location] = useLocation();
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const showFloatingQuickAdd =
    isMobile && !["/materials", "/material-summary"].includes(location);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("task");
  const [text, setText] = useState("");
  const [sessionDraft, setSessionDraft] = useState<QuickAddSessionDraft | null>(
    null
  );
  const sessionDraftClaimRef = useRef(false);
  const creationClaimRef = useRef(false);

  useEffect(() => {
    if (!sessionDraft) sessionDraftClaimRef.current = false;
  }, [sessionDraft]);
  useEffect(() => {
    if (open) creationClaimRef.current = false;
  }, [open]);

  useKeyboardShortcut(useCallback(() => setOpen(true), []));

  const firstDeck = state.decks[0];
  const subjects = useMemo(
    () => state.profile?.subjects ?? [],
    [state.profile?.subjects]
  );

  // natural-language parse preview (live as the user types)
  const nlp = useMemo(
    () => (text.trim() ? parseQuickAdd(text, subjects) : null),
    [text, subjects]
  );
  const sessionPreview = useMemo(() => {
    if (kind !== "session" || !text.trim() || nlp?.durationError) return null;
    const parsed = nlp ?? parseQuickAdd(text.trim(), subjects);
    return {
      ...buildQuickAddSessionDraft(text.trim(), parsed, subjects, todayStr()),
      dateLabel: parsed.dateLabel ?? "today",
    };
  }, [kind, nlp, subjects, text]);

  const beginSessionReview = () => {
    const raw = text.trim();
    if (!raw) return;
    const parsed = nlp ?? parseQuickAdd(raw, subjects);
    if (parsed.durationError) return toast.error(parsed.durationError);
    sessionDraftClaimRef.current = false;
    setSessionDraft(
      buildQuickAddSessionDraft(raw, parsed, subjects, todayStr())
    );
  };

  const submit = () => {
    const raw = text.trim();
    if (!raw) return;
    const { title, amount } = parseAmount(raw);
    const n = nlp ?? parseQuickAdd(raw, subjects);
    if (kind === "session" && n.durationError)
      return toast.error(n.durationError);
    const subject =
      n.subject ??
      subjects.find(s => raw.toLowerCase().includes(s.toLowerCase())) ??
      subjects[0] ??
      "";
    const today = todayStr();
    const dueDate = kind === "task" || kind === "session" ? (n.date ?? "") : "";

    switch (kind) {
      case "task": {
        if (creationClaimRef.current) return;
        creationClaimRef.current = true;
        const taskAccepted = addTask({
          title,
          description: "",
          subject,
          dueDate,
          priority: n.priority ?? "medium",
          status: "todo",
        });
        if (!taskAccepted) {
          creationClaimRef.current = false;
          return;
        }
        toast.success(`Task added: “${title}”`);
        break;
      }
      case "session": {
        if (!sessionDraft) {
          beginSessionReview();
          return;
        }
        {
          const validationError = validQuickAddSessionDraft(sessionDraft);
          if (validationError) return toast.error(validationError);
        }
        if (sessionDraftClaimRef.current) return;
        sessionDraftClaimRef.current = true;
        const sessionAccepted = addSession({
          subject: sessionDraft.subject.trim(),
          topic: sessionDraft.title.trim(),
          date: sessionDraft.date,
          startTime: new Date().toTimeString().slice(0, 5),
          duration: sessionDraft.duration,
          difficulty: "medium",
          priority: "medium",
          notes: "",
          status: QUICK_ADD_SESSION_STATUS,
        });
        if (!sessionAccepted) {
          sessionDraftClaimRef.current = false;
          return;
        }
        toast.success(`Study session planned: “${sessionDraft.title.trim()}”`);
        break;
      }
      case "card": {
        const parts = title
          .split(/[:;—–-]/)
          .map(p => p.trim())
          .filter(Boolean);
        if (parts.length >= 2 && firstDeck) {
          if (creationClaimRef.current) return;
          creationClaimRef.current = true;
          const cardAccepted = addCard(firstDeck.id, {
            front: parts[0],
            back: parts.slice(1).join(" "),
            status: "new",
          });
          if (!cardAccepted) {
            creationClaimRef.current = false;
            return;
          }
          toast.success(`Flashcard added to “${firstDeck.name}”`);
        } else {
          return toast.error(
            "Use “front : back” and pick a deck first (or add a deck)."
          );
        }
        break;
      }
      case "expense":
        if (validQuickAddExpenseAmount(amount)) {
          if (creationClaimRef.current) return;
          creationClaimRef.current = true;
          const transactionAccepted = addTransaction({
            type: "expense",
            amount,
            category: "other",
            label: title,
            date: today,
          });
          if (!transactionAccepted) {
            creationClaimRef.current = false;
            return;
          }
          toast.success(`Expense logged: ${title}`);
        } else {
          return toast.error("Add an amount, e.g. “Lunch 4.50”");
        }
        break;
    }
    setText("");
    setSessionDraft(null);
    setOpen(false);
    notify(`Quick-added: ${title}`);
  };

  const Icon = useMemo(
    () => KINDS.find(k => k.key === kind)?.icon ?? ListTodo,
    [kind]
  );

  return (
    <>
      {/* Mobile floating action button */}
      {showFloatingQuickAdd && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Quick add"
          className="btn-sunrise fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center shadow-lg md:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0">
          <DialogTitle className="sr-only">Quick add</DialogTitle>
          <Tabs
            value={kind}
            onValueChange={v => {
              setKind(v as Kind);
              setSessionDraft(null);
            }}
            className="w-full"
          >
            <TabsList className="m-4 w-full justify-start rounded-full bg-secondary/70">
              {KINDS.map(({ key, label, icon: KIcon }) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-1.5 rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <KIcon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="px-4 pb-2">
            {!sessionDraft && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-primary">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <Input
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    setSessionDraft(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (kind === "session") beginSessionReview();
                      else submit();
                    }
                  }}
                  placeholder={
                    kind === "task"
                      ? "Math homework chapter 4"
                      : kind === "session"
                        ? "Physics past paper"
                        : kind === "card"
                          ? "Mitosis : cell division…"
                          : "Lunch 4.50"
                  }
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  autoFocus
                />
                <span className="kbd-cmd">⌘K</span>
              </div>
            )}
            {nlp &&
              (kind === "task" || kind === "session") &&
              nlpSummary(nlp) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px] font-medium"
                  >
                    <CalendarDays className="mr-1 h-3 w-3" /> Smart:{" "}
                    {nlpSummary(nlp)}
                  </Badge>
                </div>
              )}
            {kind === "session" && nlp?.durationError && (
              <p
                role="alert"
                className="mt-2 text-xs font-medium text-destructive"
              >
                {nlp.durationError}
              </p>
            )}
            {sessionPreview && !sessionDraft && (
              <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                <span className="font-semibold">Detected plan:</span>{" "}
                {sessionPreview.title} · {sessionPreview.subject} ·{" "}
                {sessionPreview.dateLabel} ({sessionPreview.date}) ·{" "}
                {sessionPreview.duration} min
              </div>
            )}
            {sessionDraft && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">
                    Confirm and edit this study plan
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setSessionDraft(null)}
                  >
                    Edit original text
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="mb-1 block text-[11px]">Topic</Label>
                    <Input
                      value={sessionDraft.title}
                      onChange={event =>
                        setSessionDraft(draft =>
                          draft
                            ? { ...draft, title: event.target.value }
                            : draft
                        )
                      }
                      className="h-9 rounded-lg bg-card text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px]">Subject</Label>
                    <Input
                      value={sessionDraft.subject}
                      onChange={event =>
                        setSessionDraft(draft =>
                          draft
                            ? { ...draft, subject: event.target.value }
                            : draft
                        )
                      }
                      className="h-9 rounded-lg bg-card text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px]">Date</Label>
                    <Input
                      type="date"
                      value={sessionDraft.date}
                      onChange={event =>
                        setSessionDraft(draft =>
                          draft ? { ...draft, date: event.target.value } : draft
                        )
                      }
                      className="h-9 rounded-lg bg-card text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[11px]">
                      Duration (minutes)
                    </Label>
                    <Input
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      value={sessionDraft.duration}
                      onChange={event =>
                        setSessionDraft(draft =>
                          draft
                            ? { ...draft, duration: Number(event.target.value) }
                            : draft
                        )
                      }
                      className="h-9 rounded-lg bg-card text-sm"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  This will create a planned session only. It adds no study
                  evidence until you mark it complete.
                </p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {kind === "card"
                ? `Writing to “${firstDeck?.name ?? "no deck"}”. Write “front : back”.`
                : kind === "expense"
                  ? "Include the amount at the end, e.g. “Bus fare 2”."
                  : kind === "session"
                    ? "Review the detected schedule, then plan it. A planned session adds no study evidence until you complete it."
                    : subjects.length
                      ? `Type naturally: “${subjects[0]} chapter 4 tomorrow 30 min” — subject, date & duration are detected automatically.`
                      : "Task will be added with no subject tag."}
            </p>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3">
            <Button variant="sunrise" onClick={submit} className="w-full">
              <Plus className="h-4 w-4" />{" "}
              {kind === "session"
                ? sessionDraft
                  ? "Confirm planned session"
                  : "Review session"
                : `Add ${KINDS.find(k => k.key === kind)?.label}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
