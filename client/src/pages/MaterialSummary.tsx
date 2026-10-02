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
import { useStore } from "@/contexts/StoreContext";
import {
  downloadReviewedPracticeQuestionsPdf,
  isMaterialPracticeDraftReviewed,
  type MaterialPracticeQuestionDraft,
} from "@/lib/practiceQuestionPdf";
import { trpc } from "@/lib/trpc";
import {
  BrainCircuit,
  FileDown,
  FileSearch,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

type SummaryDraft = {
  title: string;
  summary: string;
  keyIdeas: string[];
  reviewQuestions: string[];
};
type PracticePrompt = { prompt: string; correct: string; distractor: string };
type DraftMaterial = { storageKey: string; subject: string; topicId?: string };
type BoundSummaryDraft = SummaryDraft & {
  material: DraftMaterial;
  consentAt: string;
};
type BoundMaterialQuestionDraft = MaterialPracticeQuestionDraft & {
  material: DraftMaterial;
};

export default function MaterialSummary() {
  const {
    state,
    markStudyMaterialAiConsent,
    markStudyMaterialAiPracticeQuestionConsent,
    saveMaterialFlashcardDraft,
    createQuiz,
  } = useStore();
  const [storageKey, setStorageKey] = useState("");
  const [draft, setDraft] = useState<BoundSummaryDraft | null>(null);
  const [savedAsCards, setSavedAsCards] = useState(false);
  const [practicePrompts, setPracticePrompts] = useState<
    PracticePrompt[] | null
  >(null);
  const [practiceError, setPracticeError] = useState("");
  const [materialQuestionDraft, setMaterialQuestionDraft] =
    useState<BoundMaterialQuestionDraft | null>(null);
  const [confirmedQuestions, setConfirmedQuestions] = useState<
    Record<number, boolean>
  >({});
  const [questionDraftError, setQuestionDraftError] = useState("");
  const [isExportingQuestions, setIsExportingQuestions] = useState(false);
  const manualQuizSaveClaimRef = useRef(false);
  const generatedQuizSaveClaimRef = useRef(false);
  const summaryFlashcardSaveClaimRef = useRef(false);
  const summaryRequestMaterialRef = useRef<string | null>(null);
  const practiceRequestMaterialRef = useRef<string | null>(null);
  const pdfs = state.studyMaterials.filter(
    material => material.mimeType === "application/pdf"
  );
  const selected = pdfs.find(material => material.storageKey === storageKey);
  const canonicalTopics = Array.from(
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
  );
  const allGeneratedQuestionsReviewed = materialQuestionDraft
    ? isMaterialPracticeDraftReviewed(
        materialQuestionDraft.questions.length,
        confirmedQuestions
      )
    : false;
  const summary = trpc.studyMaterials.summary.useMutation();
  const practiceQuestions = trpc.studyMaterials.practiceQuestions.useMutation();

  useEffect(() => {
    if (!practicePrompts) manualQuizSaveClaimRef.current = false;
  }, [practicePrompts]);
  useEffect(() => {
    if (!materialQuestionDraft) generatedQuizSaveClaimRef.current = false;
  }, [materialQuestionDraft]);
  useEffect(() => {
    if (draft) summaryFlashcardSaveClaimRef.current = false;
  }, [draft]);

  const selectMaterial = (value: string) => {
    summaryRequestMaterialRef.current = null;
    practiceRequestMaterialRef.current = null;
    setStorageKey(value);
    setDraft(null);
    setPracticePrompts(null);
    setMaterialQuestionDraft(null);
    setConfirmedQuestions({});
    setPracticeError("");
    setQuestionDraftError("");
  };
  const requestSummary = () => {
    if (!selected) return;
    const material: DraftMaterial = {
      storageKey: selected.storageKey,
      subject: selected.subject,
      ...(selected.topicId ? { topicId: selected.topicId } : {}),
    };
    summaryRequestMaterialRef.current = material.storageKey;
    summary.mutate(
      { storageKey: material.storageKey },
      {
        onSuccess: value => {
          if (summaryRequestMaterialRef.current !== material.storageKey) return;
          const { draft: summaryDraft, consentAt } = value;
          setDraft({ ...summaryDraft, material, consentAt });
          setSavedAsCards(false);
          setPracticePrompts(null);
          setPracticeError("");
          markStudyMaterialAiConsent(material.storageKey, consentAt);
        },
      }
    );
  };
  const requestPracticeQuestions = () => {
    if (!selected) return;
    const material: DraftMaterial = {
      storageKey: selected.storageKey,
      subject: selected.subject,
      ...(selected.topicId ? { topicId: selected.topicId } : {}),
    };
    practiceRequestMaterialRef.current = material.storageKey;
    practiceQuestions.mutate(
      { storageKey: material.storageKey },
      {
        onSuccess: value => {
          if (practiceRequestMaterialRef.current !== material.storageKey)
            return;
          setMaterialQuestionDraft({ ...value.draft, material });
          setConfirmedQuestions({});
          setQuestionDraftError("");
          markStudyMaterialAiPracticeQuestionConsent(
            material.storageKey,
            value.consentAt
          );
        },
      }
    );
  };
  const startPracticeBuilder = () => {
    if (!draft) return;
    setPracticePrompts(
      draft.reviewQuestions.map(prompt => ({
        prompt,
        correct: "",
        distractor: "",
      }))
    );
    setPracticeError("");
  };
  const savePracticeQuiz = () => {
    if (!draft || !practicePrompts) return;
    if (
      !practicePrompts.length ||
      practicePrompts.some(
        prompt => !prompt.correct.trim() || !prompt.distractor.trim()
      )
    ) {
      setPracticeError(
        "For each prompt, verify the correct answer and add a plausible alternative before saving."
      );
      return;
    }
    const currentTopic = draft.material.topicId
      ? canonicalTopics.find(topic => topic.id === draft.material.topicId)
      : undefined;
    if (draft.material.topicId && !currentTopic) {
      setPracticeError(
        "This material’s linked topic was removed. Keep reviewing the prompts or select a current topic and request a new draft."
      );
      return;
    }
    if (manualQuizSaveClaimRef.current) return;
    manualQuizSaveClaimRef.current = true;
    const accepted = createQuiz({
      title: `${draft.title} — reviewed practice`,
      subject: currentTopic?.subject ?? draft.material.subject,
      topic: currentTopic?.name ?? "",
      ...(currentTopic ? { topicId: currentTopic.id } : {}),
      source: "manual",
      questions: practicePrompts.map(prompt => ({
        prompt: prompt.prompt,
        type: "multiple_choice" as const,
        options: [prompt.correct.trim(), prompt.distractor.trim()],
        correctOptionIndex: 0,
        explanation:
          "Answer choices were reviewed and entered by the learner from their selected material.",
      })),
    });
    if (!accepted) {
      manualQuizSaveClaimRef.current = false;
      setPracticeError(
        "We could not save this reviewed quiz. Your prompts are still here."
      );
      return;
    }
    setPracticePrompts(null);
    setPracticeError("");
  };
  const saveGeneratedQuiz = () => {
    if (!materialQuestionDraft) return;
    if (!allGeneratedQuestionsReviewed) {
      setQuestionDraftError(
        "Review each proposed answer and explanation against your PDF before saving this quiz."
      );
      return;
    }
    const currentTopic = materialQuestionDraft.material.topicId
      ? canonicalTopics.find(
          topic => topic.id === materialQuestionDraft.material.topicId
        )
      : undefined;
    if (materialQuestionDraft.material.topicId && !currentTopic) {
      setQuestionDraftError(
        "This material’s linked topic was removed. Keep reviewing the draft or select a current topic and request a new draft."
      );
      return;
    }
    if (generatedQuizSaveClaimRef.current) return;
    generatedQuizSaveClaimRef.current = true;
    const accepted = createQuiz({
      title: `${materialQuestionDraft.title} — reviewed material practice`,
      subject: currentTopic?.subject ?? materialQuestionDraft.material.subject,
      topic: currentTopic?.name ?? "",
      ...(currentTopic ? { topicId: currentTopic.id } : {}),
      source: "ai_draft",
      questions: materialQuestionDraft.questions.map(question => ({
        prompt: question.prompt,
        type: "multiple_choice" as const,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
      })),
    });
    if (!accepted) {
      generatedQuizSaveClaimRef.current = false;
      setQuestionDraftError(
        "We could not save this reviewed draft. It is still here for you to review."
      );
      return;
    }
    setMaterialQuestionDraft(null);
    setConfirmedQuestions({});
    setQuestionDraftError("");
  };
  const exportGeneratedQuestions = async () => {
    if (!materialQuestionDraft || !allGeneratedQuestionsReviewed) return;
    setIsExportingQuestions(true);
    setQuestionDraftError("");
    try {
      await downloadReviewedPracticeQuestionsPdf(
        materialQuestionDraft,
        confirmedQuestions
      );
    } catch {
      setQuestionDraftError(
        "The PDF could not be created in this browser. Your reviewed draft is still available here."
      );
    } finally {
      setIsExportingQuestions(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <FileSearch className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Consent-led study support
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Create material review drafts
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Choose one of your saved PDFs. Student OS verifies that it belongs
            to your signed-in workspace, then can create a summary or a
            reviewable practice-question draft from that single file.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full bg-card">
          <Link href="/materials">Study materials</Link>
        </Button>
      </header>
      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-5 text-muted-foreground">
            <strong className="text-foreground">
              Explicit consent required for every request.
            </strong>{" "}
            Selecting a file does nothing. Each AI button records consent for
            that single action, then sends only the chosen account-owned PDF
            through a signed server-side link. Generated questions are drafts;
            no quiz is saved until you review the proposed answers.
          </p>
        </div>
        <div className="mt-5">
          <Label className="mb-1.5 block text-xs font-semibold">
            Your saved PDF
          </Label>
          <Select value={storageKey} onValueChange={selectMaterial}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Choose a saved PDF" />
            </SelectTrigger>
            <SelectContent>
              {pdfs.map(material => (
                <SelectItem
                  key={material.storageKey}
                  value={material.storageKey}
                >
                  {material.subject} — {material.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!pdfs.length && (
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a PDF in Study materials before requesting a draft.
            </p>
          )}
        </div>
        {summary.error && (
          <p className="mt-3 text-sm font-medium text-destructive">
            {summary.error.message}
          </p>
        )}
        {practiceQuestions.error && (
          <p className="mt-3 text-sm font-medium text-destructive">
            {practiceQuestions.error.message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            disabled={!selected || summary.isPending}
            className="rounded-xl"
            onClick={requestSummary}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {summary.isPending
              ? "Creating summary…"
              : "I consent — create summary draft"}
          </Button>
          <Button
            disabled={!selected || practiceQuestions.isPending}
            variant="outline"
            className="rounded-xl bg-card"
            onClick={requestPracticeQuestions}
          >
            <ListChecks className="mr-1.5 h-4 w-4" />
            {practiceQuestions.isPending
              ? "Generating questions…"
              : "I consent — generate practice questions"}
          </Button>
        </div>
      </Card>
      {materialQuestionDraft && (
        <Card className="mt-6 border-primary/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            AI practice-question draft — verify before saving or exporting
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">
            {materialQuestionDraft.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {materialQuestionDraft.instructions}
          </p>
          <div className="mt-5 space-y-4">
            {materialQuestionDraft.questions.map((question, index) => (
              <div
                key={`${question.prompt}-${index}`}
                className="rounded-xl border p-4"
              >
                <p className="font-medium">
                  {index + 1}. {question.prompt}
                </p>
                <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {question.options.map((option, optionIndex) => (
                    <li
                      key={`${option}-${optionIndex}`}
                      className={
                        optionIndex === question.correctOptionIndex
                          ? "font-medium text-foreground"
                          : ""
                      }
                    >
                      {String.fromCharCode(65 + optionIndex)}. {option}
                      {optionIndex === question.correctOptionIndex
                        ? " — suggested answer"
                        : ""}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                  <strong className="text-foreground">Explanation:</strong>{" "}
                  {question.explanation}
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={Boolean(confirmedQuestions[index])}
                    onChange={event =>
                      setConfirmedQuestions(current => ({
                        ...current,
                        [index]: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    I checked this question, suggested answer, and explanation
                    against my PDF.
                  </span>
                </label>
              </div>
            ))}
          </div>
          {questionDraftError && (
            <p
              className="mt-4 text-sm font-medium text-destructive"
              role="alert"
            >
              {questionDraftError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={saveGeneratedQuiz}>
              Save reviewed practice quiz
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-card"
              disabled={!allGeneratedQuestionsReviewed || isExportingQuestions}
              onClick={exportGeneratedQuestions}
              title={
                allGeneratedQuestionsReviewed
                  ? "Download a local PDF of this reviewed draft"
                  : "Review every question before downloading"
              }
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              {isExportingQuestions ? "Creating PDF…" : "Download reviewed PDF"}
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-card"
              onClick={() => {
                setMaterialQuestionDraft(null);
                setConfirmedQuestions({});
                setQuestionDraftError("");
              }}
            >
              Discard draft
            </Button>
          </div>
          <p className="mt-4 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            The PDF is created in this browser only after every question is
            checked. It contains the reviewed questions, choices, answer key,
            and explanations for offline study; no new AI request or private
            storage link is used.
          </p>
        </Card>
      )}
      {draft && (
        <Card className="mt-6 border-primary/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            AI summary draft — review before use
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">{draft.title}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {draft.summary}
          </p>
          <section className="mt-5">
            <h3 className="font-semibold">Key ideas</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {draft.keyIdeas.map(idea => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </section>
          <section className="mt-5">
            <h3 className="font-semibold">Review questions</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {draft.reviewQuestions.map(question => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </section>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={savedAsCards}
              className="rounded-full"
              onClick={() => {
                if (summaryFlashcardSaveClaimRef.current) return;
                summaryFlashcardSaveClaimRef.current = true;
                const accepted = saveMaterialFlashcardDraft({
                  title: draft.title,
                  subject: draft.material.subject,
                  ...(draft.material.topicId
                    ? { topicId: draft.material.topicId }
                    : {}),
                  keyIdeas: draft.keyIdeas,
                });
                if (accepted) setSavedAsCards(true);
                else summaryFlashcardSaveClaimRef.current = false;
              }}
            >
              {savedAsCards
                ? "Flashcards saved"
                : "Save reviewed key ideas as flashcards"}
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-card"
              onClick={startPracticeBuilder}
            >
              <BrainCircuit className="mr-1.5 h-4 w-4" />
              Build manual quiz from summary prompts
            </Button>
            <Button asChild variant="outline" className="rounded-full bg-card">
              <Link href="/flashcards">Open flashcards</Link>
            </Button>
          </div>
          <p className="mt-5 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            This is a review draft. Check it against your material before
            relying on it in assessed work.
          </p>
        </Card>
      )}
      {practicePrompts && (
        <Card className="mt-6 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Learner-validated quiz builder
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">
            Turn summary prompts into practice
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Student OS does not invent answer keys from a summary. Confirm the
            correct answer and one alternative for every prompt before saving a
            normal editable quiz.
          </p>
          <div className="mt-5 space-y-4">
            {practicePrompts.map((entry, index) => (
              <div
                key={`${entry.prompt}-${index}`}
                className="rounded-xl border p-4"
              >
                <p className="text-sm font-medium">
                  {index + 1}. {entry.prompt}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs font-semibold">
                      Correct answer you verified
                    </Label>
                    <Input
                      value={entry.correct}
                      onChange={event =>
                        setPracticePrompts(
                          current =>
                            current?.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, correct: event.target.value }
                                : item
                            ) ?? null
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-semibold">
                      Plausible alternative
                    </Label>
                    <Input
                      value={entry.distractor}
                      onChange={event =>
                        setPracticePrompts(
                          current =>
                            current?.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, distractor: event.target.value }
                                : item
                            ) ?? null
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {practiceError && (
            <p className="mt-4 text-sm font-medium text-destructive">
              {practiceError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={savePracticeQuiz}>
              Save reviewed practice quiz
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-card"
              onClick={() => {
                setPracticePrompts(null);
                setPracticeError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
