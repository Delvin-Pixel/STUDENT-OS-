/* STUDENT OS — Flashcards. Deck CRUD + review mode with flip, easy/difficult,
   shuffle, and per-deck progress tracking. */

import { BrandedEmpty, ProgressBar, SubjectBadge } from "@/components/AppBits";
import { Badge } from "@/components/ui/badge";
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
import {
  getDueFlashcards,
  scheduleFlashcardReview,
  type ReviewGrade,
} from "@/lib/spacedRepetition";
import type { Deck, Flashcard } from "@/lib/types";
import { cn, todayStr } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Layers,
  Plus,
  RotateCw,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export default function Flashcards() {
  const { state, deleteDeck, deleteCard, updateCard } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardDialog, setCardDialog] = useState<string | null>(null); // deck id or null
  const [reviewing, setReviewing] = useState<string | null>(null);

  const reviewedCount = useMemo(
    () =>
      state.decks.reduce(
        (sum, d) => sum + d.cards.filter(c => c.status !== "new").length,
        0
      ),
    [state.decks]
  );

  useEffect(() => {
    if (reviewing && !state.decks.some(deck => deck.id === reviewing))
      setReviewing(null);
  }, [reviewing, state.decks]);

  if (reviewing) {
    const deck = state.decks.find(d => d.id === reviewing);
    if (!deck) return null;
    return (
      <ReviewMode
        deck={deck}
        onExit={() => setReviewing(null)}
        onMark={(cardId, grade, prior) =>
          updateCard(deck.id, cardId, scheduleFlashcardReview(prior, grade))
        }
        onDeleteCard={cardId => deleteCard(deck.id, cardId)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Flashcards
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {reviewedCount} card{reviewedCount === 1 ? "" : "s"} reviewed so far
          </p>
        </div>
        <Button variant="sunrise" onClick={() => setDialogOpen(true)}>
          + New deck
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {state.decks.length === 0 ? (
          <div className="sm:col-span-2">
            <BrandedEmpty
              icon={Layers}
              title="No decks yet"
              text="Flashcards are the fastest way to remember anything. Create your first deck and add a few cards."
              coach="Three cards is a start. Ten minutes tomorrow is a habit."
              actionLabel="+ Create Deck"
              onAction={() => setDialogOpen(true)}
            />
          </div>
        ) : (
          state.decks.map(d => {
            const total = d.cards.length;
            const done = d.cards.filter(c => c.status !== "new").length;
            const hard = d.cards.filter(c => c.status === "difficult").length;
            const due = d.cards.filter(
              c =>
                !(c.nextReviewDate ?? c.dueDate) ||
                (c.nextReviewDate ?? c.dueDate)! <= todayStr()
            ).length;
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm lift-card"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-semibold">
                      {d.name}
                    </h3>
                    {d.subject && (
                      <div className="mt-1.5">
                        <SubjectBadge subject={d.subject} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteDeck(d.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete deck"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="rounded-full">
                    {total} cards
                  </Badge>
                  {done > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-primary/10 text-primary"
                    >
                      {done} reviewed
                    </Badge>
                  )}
                  {hard > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-destructive/10 text-destructive"
                    >
                      {hard} difficult
                    </Badge>
                  )}
                  {due > 0 && (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-primary/10 text-primary"
                    >
                      {due} due now
                    </Badge>
                  )}
                </div>
                <ProgressBar
                  value={total ? (done / total) * 100 : 0}
                  className="mt-3"
                />
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-full"
                    disabled={total === 0}
                    onClick={() => setReviewing(d.id)}
                  >
                    <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full bg-card"
                    onClick={() => setCardDialog(d.id)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Card
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <DeckDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <CardDialog
        open={cardDialog !== null}
        onOpenChange={o => !o && setCardDialog(null)}
        deckId={cardDialog}
      />
    </div>
  );
}

function DeckDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, addDeck } = useStore();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [topicId, setTopicId] = useState("");
  const [error, setError] = useState("");
  const deckSaveClaimRef = useRef(false);

  useEffect(() => {
    if (open) deckSaveClaimRef.current = false;
  }, [open]);
  const topicOptions = useMemo(
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
  const resolvedTopicId =
    topicId && topicOptions.some(topic => topic.id === topicId) ? topicId : "";

  useEffect(() => {
    if (topicId && !resolvedTopicId) setTopicId("");
  }, [resolvedTopicId, topicId]);

  const submit = () => {
    if (!name.trim()) return setError("Give your deck a name.");
    if (deckSaveClaimRef.current) return;
    deckSaveClaimRef.current = true;
    addDeck({
      name: name.trim(),
      subject,
      topicId: resolvedTopicId || undefined,
    });
    setName("");
    setSubject("");
    setTopicId("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New deck</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Deck name
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Electromagnetism"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Subject
            </Label>
            <Select
              value={subject || "_none"}
              onValueChange={v => setSubject(v === "_none" ? "" : v)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {(state.profile?.subjects ?? []).map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
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
                const selected = topicOptions.find(topic => topic.id === next);
                if (selected) setSubject(selected.subject);
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No linked topic</SelectItem>
                {topicOptions.map(topic => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.subject} — {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} variant="sunrise">
            Create deck
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CardDialog({
  open,
  onOpenChange,
  deckId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deckId: string | null;
}) {
  const { addCard } = useStore();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState("");
  const saveClaimRef = useRef(false);

  useEffect(() => {
    if (open) saveClaimRef.current = false;
  }, [open]);

  const submit = () => {
    if (!front.trim() || !back.trim())
      return setError("Fill in both sides of the card.");
    if (!deckId)
      return setError("Choose an available deck before saving this card.");
    if (saveClaimRef.current) return;
    saveClaimRef.current = true;
    if (
      !addCard(deckId, {
        front: front.trim(),
        back: back.trim(),
        status: "new",
      })
    ) {
      saveClaimRef.current = false;
      return setError(
        "That deck is no longer available. Your card text is still here—choose another deck."
      );
    }
    setFront("");
    setBack("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Front (question)
            </Label>
            <Textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder="e.g. What is electromagnetic induction?"
              className="rounded-xl"
              rows={2}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Back (answer)
            </Label>
            <Textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder="e.g. The production of an electromotive force…"
              className="rounded-xl"
              rows={3}
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}
          <Button onClick={submit} variant="sunrise">
            Add card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewMode({
  deck,
  onExit,
  onMark,
  onDeleteCard,
}: {
  deck: Deck;
  onExit: () => void;
  onMark: (cardId: string, grade: ReviewGrade, prior: Flashcard) => void;
  onDeleteCard: (cardId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const reviewedCardRef = useRef<string | null>(null);

  const cards = useMemo(() => {
    const pool = getDueFlashcards(deck.cards);
    if (shuffled) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    return pool;
  }, [deck.cards, shuffled]);

  const card = cards[index];
  const done = deck.cards.filter(c => c.status !== "new").length;
  const total = deck.cards.length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="rounded-full p-2 hover:bg-accent"
          aria-label="Back to decks"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold">
            {deck.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {done}/{total} reviewed
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-card"
            onClick={() => {
              setShuffled(s => !s);
              setIndex(0);
            }}
          >
            <Shuffle className="mr-1 h-3.5 w-3.5" />{" "}
            {shuffled ? "Ordered" : "Shuffle"}
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <BrandedEmpty
          icon={Layers}
          title="This deck is empty"
          text="Add cards first, then come back to review."
          actionLabel="Back"
          onAction={onExit}
        />
      ) : cards.length === 0 ? (
        <BrandedEmpty
          icon={Layers}
          title="No cards are due today"
          text="Your next review is scheduled for a future date. Student OS will keep the card out of today’s review queue so your recall plan stays realistic."
          actionLabel="Back to decks"
          onAction={onExit}
        />
      ) : !card ? (
        <BrandedEmpty
          icon={Layers}
          title="You've reached the end"
          text="Shuffle to review again, or go back and add more cards."
          actionLabel="Back to decks"
          onAction={onExit}
        />
      ) : (
        <>
          <div className="flip-container mx-auto mt-6 h-72 w-full sm:h-80">
            <div
              className={cn(
                "flip-inner relative h-full w-full",
                flipped && "flipped"
              )}
            >
              <div
                onClick={flipCard}
                onKeyDown={handleFlipKeyDown}
                className="flip-face absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-md"
                role="button"
                tabIndex={0}
                aria-pressed={flipped}
                aria-label="Flip card"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Question
                </span>
                <p className="mt-3 font-display text-xl font-semibold">
                  {card.front}
                </p>
                <span className="mt-auto text-[11px] text-muted-foreground">
                  Tap to flip
                </span>
              </div>
              <div
                onClick={flipCard}
                onKeyDown={handleFlipKeyDown}
                className="flip-face flip-back absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center shadow-md"
                role="button"
                tabIndex={0}
                aria-pressed={flipped}
                aria-label="Flip card back"
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Answer
                </span>
                <p className="mt-3 text-base leading-relaxed">{card.back}</p>
                <span className="mt-auto text-[11px] text-muted-foreground">
                  Tap to flip back
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              variant="outline"
              className="rounded-full bg-card"
              onClick={() => markCard("again")}
            >
              <X className="mr-1.5 h-4 w-4 text-destructive" /> Again
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-card"
              onClick={() => markCard("hard")}
            >
              Hard
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-card"
              onClick={() => markCard("good")}
            >
              <Check className="mr-1.5 h-4 w-4" /> Good
            </Button>
            <Button className="rounded-full" onClick={() => markCard("easy")}>
              <Check className="mr-1.5 h-4 w-4" /> Easy
            </Button>
          </div>
          {typeof card.retentionEstimate === "number" && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Estimated recall after this review:{" "}
              {Math.round(card.retentionEstimate * 100)}%
            </p>
          )}
          <div className="mt-4 flex justify-center gap-1">
            {cards.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-muted"
                )}
              />
            ))}
          </div>
          {card.status === "difficult" && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => onDeleteCard(card.id)}
                className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Delete this card
              </button>
            </div>
          )}
        </>
      )}

      {/* difficult backlog banner */}
      {deck.cards.some(c => c.status === "difficult") && (
        <div className="mt-6 rounded-xl bg-destructive/8 p-3.5 text-xs text-destructive">
          {deck.cards.filter(c => c.status === "difficult").length} difficult
          card
          {deck.cards.filter(c => c.status === "difficult").length === 1
            ? ""
            : "s"}{" "}
          will keep resurfacing until you mark them easy.
        </div>
      )}
    </div>
  );

  function next() {
    setFlipped(false);
    setTimeout(() => setIndex(i => (i + 1) % cards.length), 180);
  }

  function flipCard() {
    setFlipped(current => !current);
  }

  function handleFlipKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    flipCard();
  }

  function markCard(grade: ReviewGrade) {
    if (reviewedCardRef.current === card.id) return;
    reviewedCardRef.current = card.id;
    onMark(card.id, grade, card);
    next();
  }
}
