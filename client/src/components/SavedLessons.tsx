/* STUDENT OS — Saved Lessons library.
   Every Daily Lesson a student bookmarked lives here for later review.
   Lessons are keyed by their deterministic selection key so the same day
   can never be bookmarked twice. */

import { BrandedEmpty } from "@/components/AppBits";
import { LessonText } from "@/components/DailyLesson";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/contexts/StoreContext";
import { formatDateHuman, isoDate, subjectColor } from "@/lib/utils";
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  Trash2,
} from "lucide-react";

export default function SavedLessons() {
  const { state, removeSavedLesson } = useStore();
  const saved = [...state.savedLessons].sort((a, b) =>
    a.savedAt < b.savedAt ? 1 : -1
  );

  return (
    <section aria-labelledby="saved-lessons-heading">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
            <BookMarked className="h-3.5 w-3.5" /> Library
          </div>
          <h2
            id="saved-lessons-heading"
            className="mt-1 font-display text-xl font-bold"
          >
            Saved lessons
          </h2>
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 rounded-full px-3 py-1 text-xs"
        >
          {saved.length} saved
        </Badge>
      </div>

      {saved.length === 0 ? (
        <BrandedEmpty
          icon={BookOpen}
          title="No saved lessons yet"
          text="Bookmark any Daily Lesson with the save button and it will appear here, ready for revision before your exams."
          coach="Today's lesson card has a bookmark icon — tap it to save the topic for later."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {saved.map(lesson => (
            <Card
              key={lesson.id}
              className="lift-card overflow-hidden border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${subjectColor(lesson.subject).text}`}
                    >
                      {lesson.subject}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full px-2.5 py-0.5 text-[11px]"
                    >
                      {lesson.branch}
                    </Badge>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold">
                    {lesson.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lesson.strapline}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> Lesson from{" "}
                      {formatDateHuman(lesson.dateStr)}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookMarked className="h-3.5 w-3.5" /> Saved{" "}
                      {formatDateHuman(isoDate(new Date(lesson.savedAt)))}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove from saved lessons"
                  className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeSavedLesson(lesson.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 rounded-2xl bg-accent/50 p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <Lightbulb className="h-4 w-4" /> What you were aiming to
                  learn
                </p>
                <ul className="mt-2 space-y-1.5">
                  {lesson.learningGoals.map(goal => (
                    <li key={goal} className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              {lesson.recap && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Revision recap
                  </p>
                  <LessonText className="text-sm leading-6 text-foreground/85">
                    {lesson.recap}
                  </LessonText>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
