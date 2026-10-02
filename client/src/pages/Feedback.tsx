import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/contexts/StoreContext";
import {
  AI_ANSWER_FEEDBACK_REASON_OPTIONS,
  feedbackReasonLabel,
  summarizeAiAnswerRatings,
} from "@/lib/answerRatings";
import {
  BarChart3,
  BookOpen,
  Bot,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";

function displayWhen(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function Feedback() {
  const { state, clearAiAnswerRatings, updateAiAnswerReason } = useStore();
  const summary = summarizeAiAnswerRatings(state.aiAnswerRatings);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
            <BarChart3 className="h-3.5 w-3.5" /> Private feedback
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold">
            Your AI answer feedback
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Review the answers you rated on this device. This history is private
            to your Student OS workspace.
          </p>
        </div>
        {summary.total > 0 && (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={clearAiAnswerRatings}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear history
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rated answers
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {summary.total}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Helpful
          </p>
          <p className="mt-1 flex items-center gap-2 font-display text-3xl font-bold">
            <ThumbsUp className="h-5 w-5 text-primary" />
            {summary.helpful}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Helpfulness
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {summary.helpfulPercent}%
          </p>
        </Card>
      </div>

      {summary.total === 0 ? (
        <Card className="mt-6 border-dashed p-8 text-center">
          <BarChart3 className="mx-auto h-7 w-7 text-primary" />
          <h2 className="mt-3 font-display text-lg font-bold">
            No rated answers yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the thumbs controls beneath a Lesson Q&A or Study Assistant
            answer to save private feedback here.
          </p>
        </Card>
      ) : (
        <>
          <p className="mt-5 text-xs text-muted-foreground">
            Ratings saved before this page was added may not include an answer
            preview; Student OS does not recreate or fetch that missing content.
          </p>
          <div className="mt-3 space-y-3">
            {summary.ordered.map(entry => (
              <Card key={`${entry.surface}-${entry.answerId}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    {entry.surface === "lesson" ? (
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    )}{" "}
                    {entry.surface === "lesson"
                      ? "Lesson Q&A"
                      : "Study Assistant"}{" "}
                    · {displayWhen(entry.ratedAt)}
                  </div>
                  {entry.rating === "up" ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <ThumbsUp className="h-3.5 w-3.5" /> Helpful
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <ThumbsDown className="h-3.5 w-3.5" /> Not helpful
                    </span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {entry.answerPreview ||
                    "Answer preview unavailable for this earlier rating."}
                </p>
                {entry.rating === "down" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                    <span className="text-xs text-muted-foreground">
                      Reason:
                    </span>
                    <Select
                      value={entry.reason ?? "none"}
                      onValueChange={value =>
                        updateAiAnswerReason(
                          entry.answerId,
                          entry.surface,
                          value === "none"
                            ? undefined
                            : (value as typeof entry.reason)
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-[230px] rounded-lg text-xs">
                        <SelectValue
                          placeholder={
                            feedbackReasonLabel(entry.reason) ??
                            "No reason selected"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No reason selected</SelectItem>
                        {AI_ANSWER_FEEDBACK_REASON_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
