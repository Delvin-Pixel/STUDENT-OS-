import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { academicSelectionLabelFor } from "@/lib/academicOfferings";
import { buildFocusedAssessmentRequest } from "@/lib/assessmentGeneration";
import { trpc } from "@/lib/trpc";
import { BrainCircuit, CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

type QuizDraft = {
  title: string;
  instructions: string;
  questions: Array<{
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    difficulty?: "easy" | "medium" | "hard";
    subtopic?: string;
  }>;
};
type ReviewedQuizDraft = {
  value: QuizDraft;
  subject: string;
  topic: string;
  topicId?: string;
};

export default function QuizDrafts() {
  const { state, createQuiz, notify } = useStore();
  const [, navigate] = useLocation();
  const profileSelections = useMemo(
    () => state.profile?.subjects ?? [],
    [state.profile?.subjects]
  );
  const selectionLabel = academicSelectionLabelFor(
    state.profile?.educationLevel ?? "Other"
  );
  const [selectedSubject, setSelectedSubject] = useState("");
  const [typedTopic, setTypedTopic] = useState("");
  const [learningContext, setLearningContext] = useState("");
  const [draft, setDraft] = useState<ReviewedQuizDraft | null>(null);
  const draftRequestTopicRef = useRef<string | null>(null);
  const draftSaveClaimRef = useRef(false);
  const topics = useMemo(
    () =>
      Array.from(
        new Map([
          ...state.topics.map(
            topic =>
              [
                topic.id,
                { id: topic.id, subject: topic.subject, name: topic.name },
              ] as const
          ),
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
  const generate = trpc.learningDrafts.quiz.useMutation();

  useEffect(() => {
    if (selectedSubject && profileSelections.includes(selectedSubject)) return;
    setSelectedSubject(profileSelections[0] ?? "");
  }, [profileSelections, selectedSubject]);

  const requestDraft = () => {
    const subject = selectedSubject.trim();
    const topic = typedTopic.trim();
    if (!subject || !topic || !state.profile) return;
    const linkedTopic = topics.find(
      candidate =>
        candidate.subject === subject &&
        candidate.name.localeCompare(topic, undefined, {
          sensitivity: "accent",
        }) === 0
    );
    const requestKey = `${subject}\u0000${topic}`;
    const focusedAssessment = linkedTopic
      ? buildFocusedAssessmentRequest(state, linkedTopic.id, "diagnostic")
      : undefined;
    draftRequestTopicRef.current = requestKey;
    draftSaveClaimRef.current = false;
    generate.mutate(
      {
        subject,
        topic,
        educationLevel: state.profile.educationLevel,
        ...(learningContext.trim()
          ? { learningContext: learningContext.trim() }
          : {}),
        ...(focusedAssessment ? { assessmentFocus: focusedAssessment } : {}),
      },
      {
        onSuccess: value => {
          if (draftRequestTopicRef.current !== requestKey) return;
          setDraft({
            value,
            subject,
            topic,
            ...(linkedTopic ? { topicId: linkedTopic.id } : {}),
          });
        },
      }
    );
  };
  const updateQuestion = (
    index: number,
    patch: Partial<QuizDraft["questions"][number]>
  ) => {
    setDraft(current =>
      current
        ? {
            ...current,
            value: {
              ...current.value,
              questions: current.value.questions.map(
                (question, questionIndex) =>
                  questionIndex === index ? { ...question, ...patch } : question
              ),
            },
          }
        : current
    );
  };

  const acceptDraft = () => {
    if (!draft) return;
    if (draftSaveClaimRef.current) return;
    draftSaveClaimRef.current = true;
    const quizId = createQuiz({
      title: draft.value.title,
      subject: draft.subject,
      topic: draft.topic,
      ...(draft.topicId ? { topicId: draft.topicId } : {}),
      source: "ai_draft",
      questions: draft.value.questions.map(question => ({
        ...question,
        type: "multiple_choice" as const,
        ...(question.difficulty ? { difficulty: question.difficulty } : {}),
        ...(question.subtopic?.trim()
          ? { subtopic: question.subtopic.trim() }
          : {}),
      })),
    });
    if (!quizId) {
      draftSaveClaimRef.current = false;
      notify(
        "We could not save this draft. Review it and try again; it is still here.",
        "warning"
      );
      return;
    }
    setDraft(null);
    setLearningContext("");
    navigate(`/ai-quiz/library?quizId=${encodeURIComponent(quizId)}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Personalised practice
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            AI Quiz
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Choose one of the {selectionLabel}s saved in your profile, then type
            the topic you want to practise. Student OS sends only that
            selection, your education level, and optional learning context to
            create an answerable, gradeable 50-question AI Quiz. It never sends
            your full workspace and it is not saved until you explicitly review
            it.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full bg-card">
          <Link href="/ai-quiz/library">My AI quizzes</Link>
        </Button>
      </header>
      <Card className="mt-6 p-5">
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Choose your {selectionLabel}
            </Label>
            <Select
              value={selectedSubject || "_unavailable"}
              onValueChange={value => {
                draftRequestTopicRef.current = null;
                setSelectedSubject(value === "_unavailable" ? "" : value);
                setDraft(null);
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={`Choose your ${selectionLabel}`} />
              </SelectTrigger>
              <SelectContent>
                {!profileSelections.length ? (
                  <SelectItem value="_unavailable" disabled>
                    Complete your profile first
                  </SelectItem>
                ) : null}
                {profileSelections.map(subject => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label
              htmlFor="ai-quiz-topic"
              className="mb-1.5 block text-xs font-semibold"
            >
              Type your topic
            </Label>
            <Input
              id="ai-quiz-topic"
              value={typedTopic}
              onChange={event => {
                setTypedTopic(event.target.value.slice(0, 160));
                setDraft(null);
                draftRequestTopicRef.current = null;
              }}
              placeholder={`For example: ${selectionLabel === "course" ? "database normalization" : "refraction"}`}
              className="rounded-xl"
              maxLength={160}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use a topic from the {selectionLabel} you selected. You can add it
              to an exam separately if you want it linked to revision planning.
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">
              Optional learning context{" "}
              <span className="font-normal text-muted-foreground">
                (maximum 1,200 characters)
              </span>
            </Label>
            <Textarea
              value={learningContext}
              onChange={event =>
                setLearningContext(event.target.value.slice(0, 1_200))
              }
              placeholder="For example: focus on common misconceptions about refraction."
              rows={3}
              className="resize-y rounded-xl"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {learningContext.length}/1200 characters
            </p>
          </div>
          {!profileSelections.length && (
            <p className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
              Complete your profile with at least one {selectionLabel} before
              generating an AI Quiz.
            </p>
          )}
          {generate.error && (
            <p className="text-sm font-medium text-destructive">
              {generate.error.message}
            </p>
          )}
          <Button
            disabled={
              !selectedSubject || !typedTopic.trim() || generate.isPending
            }
            className="rounded-xl"
            onClick={requestDraft}
          >
            {generate.isPending ? "Creating your AI Quiz…" : "Generate AI Quiz"}
          </Button>
        </div>
      </Card>
      {draft && (
        <section className="mt-6">
          <Card className="border-primary/20 p-5">
            <div className="flex items-start gap-3">
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  AI Quiz — review before starting
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">
                  {draft.value.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {draft.value.instructions}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {draft.value.questions.map((question, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <Label
                    htmlFor={`draft-question-${index}`}
                    className="text-xs font-semibold"
                  >
                    Question {index + 1}
                  </Label>
                  <Textarea
                    id={`draft-question-${index}`}
                    value={question.prompt}
                    onChange={event =>
                      updateQuestion(index, { prompt: event.target.value })
                    }
                    rows={2}
                    className="mt-1 rounded-xl"
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <Input
                        key={optionIndex}
                        aria-label={`Question ${index + 1} option ${optionIndex + 1}`}
                        value={option}
                        onChange={event =>
                          updateQuestion(index, {
                            options: question.options.map(
                              (candidate, candidateIndex) =>
                                candidateIndex === optionIndex
                                  ? event.target.value
                                  : candidate
                            ),
                            correctOptionIndex: Math.min(
                              question.correctOptionIndex,
                              question.options.length - 1
                            ),
                          })
                        }
                        className="rounded-xl"
                      />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor={`draft-difficulty-${index}`}
                        className="text-xs font-semibold"
                      >
                        Difficulty
                      </Label>
                      <Select
                        value={question.difficulty ?? "medium"}
                        onValueChange={value =>
                          updateQuestion(index, {
                            difficulty: value as "easy" | "medium" | "hard",
                          })
                        }
                      >
                        <SelectTrigger
                          id={`draft-difficulty-${index}`}
                          className="mt-1 rounded-xl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor={`draft-subtopic-${index}`}
                        className="text-xs font-semibold"
                      >
                        Subtopic
                      </Label>
                      <Input
                        id={`draft-subtopic-${index}`}
                        value={question.subtopic ?? ""}
                        onChange={event =>
                          updateQuestion(index, {
                            subtopic: event.target.value.slice(0, 140),
                          })
                        }
                        className="mt-1 rounded-xl"
                      />
                    </div>
                  </div>
                  <Label
                    htmlFor={`draft-answer-${index}`}
                    className="mt-3 block text-xs font-semibold"
                  >
                    Correct option number
                  </Label>
                  <Input
                    id={`draft-answer-${index}`}
                    type="number"
                    min={0}
                    max={question.options.length - 1}
                    value={question.correctOptionIndex}
                    onChange={event =>
                      updateQuestion(index, {
                        correctOptionIndex: Math.max(
                          0,
                          Math.min(
                            question.options.length - 1,
                            Number(event.target.value) || 0
                          )
                        ),
                      })
                    }
                    className="mt-1 w-28 rounded-xl"
                  />
                  <Label
                    htmlFor={`draft-explanation-${index}`}
                    className="mt-3 block text-xs font-semibold"
                  >
                    Explanation
                  </Label>
                  <Textarea
                    id={`draft-explanation-${index}`}
                    value={question.explanation}
                    onChange={event =>
                      updateQuestion(index, { explanation: event.target.value })
                    }
                    rows={2}
                    className="mt-1 rounded-xl"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={acceptDraft}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Save and start AI
                Quiz
              </Button>
              <Button
                variant="outline"
                className="rounded-full bg-card"
                onClick={() => setDraft(null)}
              >
                Discard draft
              </Button>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
