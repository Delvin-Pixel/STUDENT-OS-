import { BrandedEmpty, SubjectBadge } from "@/components/AppBits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/contexts/StoreContext";
import { validateNoteDraft } from "@/lib/noteValidation";
import type { StudyNote } from "@/lib/types";
import {
  BookOpenText,
  Edit3,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const ALL_SUBJECTS = "__all";
const GENERAL = "General";

export default function Notes() {
  const { state, updateNote, deleteNote } = useStore();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [editor, setEditor] = useState<StudyNote | "new" | null>(null);

  const subjects = useMemo(
    () =>
      Array.from(
        new Set([
          GENERAL,
          ...(state.profile?.subjects ?? []),
          ...state.notes.map(note => note.subject),
        ])
      ).filter(Boolean),
    [state.notes, state.profile?.subjects]
  );
  const topics = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(topic => [topic.id, topic] as const),
          ...state.exams.flatMap(exam =>
            exam.topics.map(
              topic =>
                [
                  topic.id,
                  { id: topic.id, subject: exam.subject, name: topic.name },
                ] as const
            )
          ),
        ]).values()
      ),
    [state.exams, state.topics]
  );
  const normalized = query.trim().toLowerCase();
  const visibleNotes = useMemo(
    () =>
      state.notes
        .filter(note => subject === ALL_SUBJECTS || note.subject === subject)
        .filter(
          note =>
            !normalized ||
            `${note.title} ${note.subject} ${note.content}`
              .toLowerCase()
              .includes(normalized)
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.updatedAt.localeCompare(a.updatedAt)
        ),
    [state.notes, subject, normalized]
  );

  const hasFilter = subject !== ALL_SUBJECTS || Boolean(normalized);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Personal knowledge base
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Notes workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture class notes, summaries, and the ideas you want to revisit.
          </p>
        </div>
        <Button variant="sunrise" onClick={() => setEditor("new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          New note
        </Button>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex sm:items-center sm:gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search your notes"
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            aria-label="Search notes"
          />
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="mt-3 w-full rounded-xl sm:mt-0 sm:w-48">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUBJECTS}>All subjects</SelectItem>
            {subjects.map(item => (
              <SelectItem value={item} key={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleNotes.map(note => (
          <article
            key={note.id}
            className="flex min-h-52 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold">
                  {note.title}
                </h2>
                <div className="mt-2">
                  <SubjectBadge subject={note.subject} />
                </div>
              </div>
              {note.pinned && (
                <Pin
                  className="h-4 w-4 shrink-0 fill-primary text-primary"
                  aria-label="Pinned note"
                />
              )}
            </div>
            <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {note.content}
            </p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-5">
              <span className="text-[11px] text-muted-foreground">
                Updated {formatNoteDate(note.updatedAt)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => updateNote(note.id, { pinned: !note.pinned })}
                  aria-label={note.pinned ? "Unpin note" : "Pin note"}
                >
                  {note.pinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setEditor(note)}
                  aria-label={`Edit ${note.title}`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deleteNote(note.id)}
                  aria-label={`Delete ${note.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {visibleNotes.length === 0 && (
        <div className="mt-5">
          {hasFilter ? (
            <BrandedEmpty
              icon={Search}
              title="No notes match that search"
              text="Try another phrase or subject, or create a new note for this topic."
              actionLabel="Clear filters"
              onAction={() => {
                setQuery("");
                setSubject(ALL_SUBJECTS);
              }}
            />
          ) : (
            <BrandedEmpty
              icon={BookOpenText}
              title="Your notes live here"
              text="Keep class takeaways, formulae, and revision summaries in one private workspace."
              coach="Start with a short summary after your next lesson."
              actionLabel="Write your first note"
              onAction={() => setEditor("new")}
            />
          )}
        </div>
      )}

      <NoteEditor
        open={editor !== null}
        note={editor === "new" ? null : editor}
        subjects={subjects}
        topics={topics}
        onOpenChange={open => !open && setEditor(null)}
      />
    </div>
  );
}

function NoteEditor({
  open,
  note,
  subjects,
  topics,
  onOpenChange,
}: {
  open: boolean;
  note: StudyNote | null;
  subjects: string[];
  topics: Array<{ id: string; subject: string; name: string }>;
  onOpenChange: (open: boolean) => void;
}) {
  const { addNote, updateNote } = useStore();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(GENERAL);
  const [topicId, setTopicId] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);
  const resolvedTopicId =
    topicId && topics.some(topic => topic.id === topicId) ? topicId : "";

  const reset = (next: StudyNote | null) => {
    setTitle(next?.title ?? "");
    setSubject(next?.subject ?? GENERAL);
    setTopicId(next?.topicId ?? "");
    setContent(next?.content ?? "");
    setPinned(next?.pinned ?? false);
    setError("");
  };
  useEffect(() => {
    if (open) {
      saveClaimRef.current = false;
      reset(note);
    }
  }, [open, note]);
  useEffect(() => {
    if (topicId && !resolvedTopicId) setTopicId("");
  }, [resolvedTopicId, topicId]);
  const handleOpenChange = (next: boolean) => {
    if (next) reset(note);
    onOpenChange(next);
  };
  const save = () => {
    const draft = {
      title: title.trim(),
      subject,
      topicId: resolvedTopicId || undefined,
      content: content.trim(),
      pinned,
    };
    const validationError = validateNoteDraft(draft);
    if (validationError) return setError(validationError);
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    const accepted = note ? updateNote(note.id, draft) : addNote(draft);
    if (!accepted) {
      saveClaimRef.current = false;
      return setError(
        "We could not save that note. Your details are still here."
      );
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {note ? "Edit note" : "New note"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Title</Label>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="e.g. Newton’s laws summary"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Subject
            </Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(item => (
                  <SelectItem value={item} key={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Link a topic{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select
              value={resolvedTopicId || "_none"}
              onValueChange={value => {
                const next = value === "_none" ? "" : value;
                setTopicId(next);
                const selected = topics.find(topic => topic.id === next);
                if (selected) setSubject(selected.subject);
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No linked topic</SelectItem>
                {topics.map(topic => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.subject} — {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Your notes
            </Label>
            <Textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="Write the ideas, examples, and questions you want to remember…"
              rows={10}
              className="resize-y rounded-xl"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={pinned}
              onChange={event => setPinned(event.target.checked)}
              className="accent-primary"
            />
            Pin this note to the top
          </label>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button variant="sunrise" onClick={save}>
            {note ? "Save changes" : "Save note"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "recently"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
