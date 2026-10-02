import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/StoreContext";
import {
  academicStageFor,
  nextAcademicStage,
  stageLabel,
} from "@/lib/academicJourney";
import { getTransitionAcademicPreparation } from "@/lib/transitionAcademicPreparation";
import { getTransitionAdaptiveExecutionPlan } from "@/lib/transitionAdaptiveExecution";
import { getTransitionClosedLoop } from "@/lib/transitionClosedLoop";
import {
  calculateWassceAggregate,
  evaluateTransitionOptions,
  getDefaultTransitionHub,
  getTransitionHeadline,
  WASSCE_GRADE_POINTS,
} from "@/lib/transitionDecision";
import { getTransitionLearningPlan } from "@/lib/transitionLearningPlan";
import {
  getTransitionNextActions,
  getTransitionReadiness,
} from "@/lib/transitionPlanning";
import { rankTransitionOptions } from "@/lib/transitionRecommendations";
import type {
  GradeResult,
  TransitionDecisionHub,
  TransitionDecisionOption,
  TransitionPreparationTask,
} from "@/lib/types";
import { todayStr } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const GRADES = Object.keys(WASSCE_GRADE_POINTS);

function profileDailyCapacityMinutes(value: string): number {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return 60;
  return /minute/i.test(value) ? Math.round(amount) : Math.round(amount * 60);
}

function emptyOption(): TransitionDecisionOption {
  return {
    id: `option-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    type: "programme",
    confidence: "learner_entered",
    requiredSubjects: [],
    eligibility: "not_assessed",
  };
}

function emptyTask(): TransitionPreparationTask {
  return {
    id: `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    done: false,
  };
}

export default function Transition() {
  const { state, addTask, setTransitionDecisionHub } = useStore();
  const profile = state.profile;
  const stage = profile ? academicStageFor(profile.educationLevel) : "Other";
  const nextStage = nextAcademicStage(stage);
  const [hub, setHub] = useState<TransitionDecisionHub>(
    () => state.transitionDecisionHub ?? getDefaultTransitionHub(stage)
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (
      !state.transitionDecisionHub ||
      state.transitionDecisionHub.sourceStage !== stage
    ) {
      setHub(getDefaultTransitionHub(stage));
      return;
    }
    setHub(state.transitionDecisionHub);
  }, [state.transitionDecisionHub, stage]);

  const computed = useMemo(() => {
    const track = hub.aggregateTrack ?? "best_six";
    const aggregate =
      stage === "SHS"
        ? calculateWassceAggregate(hub.results, track)
        : undefined;
    const next = {
      ...hub,
      targetStage: hub.targetStage ?? nextStage,
      aggregateTrack: track,
      aggregate: aggregate?.aggregate,
      aggregateMethod: aggregate
        ? `WASSCE six-subject calculation (${track.replaceAll("_", " ")})`
        : undefined,
      aggregateConfidence: aggregate ? "calculated_local" : undefined,
    } as TransitionDecisionHub;
    return evaluateTransitionOptions(next);
  }, [hub, stage, nextStage]);

  const save = () => {
    setTransitionDecisionHub(computed);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const addResult = () =>
    setHub(current => ({
      ...current,
      results: [
        ...current.results,
        {
          id: `result-${Date.now()}-${current.results.length}`,
          subject: "",
          grade: "",
          category: "elective",
        },
      ],
    }));
  const updateResult = (id: string, patch: Partial<GradeResult>) =>
    setHub(current => ({
      ...current,
      results: current.results.map(result =>
        result.id === id ? { ...result, ...patch } : result
      ),
    }));
  const removeResult = (id: string) =>
    setHub(current => ({
      ...current,
      results: current.results.filter(result => result.id !== id),
    }));
  const addOption = () =>
    setHub(current => ({
      ...current,
      options: [...current.options, emptyOption()],
    }));
  const updateOption = (id: string, patch: Partial<TransitionDecisionOption>) =>
    setHub(current => ({
      ...current,
      options: current.options.map(option =>
        option.id === id ? { ...option, ...patch } : option
      ),
    }));
  const removeOption = (id: string) =>
    setHub(current => ({
      ...current,
      options: current.options.filter(option => option.id !== id),
    }));
  const addPreparationTask = () =>
    setHub(current => ({
      ...current,
      preparationTasks: [...current.preparationTasks, emptyTask()],
    }));
  const updateTask = (id: string, patch: Partial<TransitionPreparationTask>) =>
    setHub(current => ({
      ...current,
      preparationTasks: current.preparationTasks.map(task =>
        task.id === id ? { ...task, ...patch } : task
      ),
    }));
  const removeTask = (id: string) =>
    setHub(current => ({
      ...current,
      preparationTasks: current.preparationTasks.filter(task => task.id !== id),
    }));

  const rankedOptions = useMemo(
    () =>
      rankTransitionOptions(
        computed.options,
        computed.results,
        computed.aggregate
      ),
    [computed.options, computed.results, computed.aggregate]
  );
  const transitionReadiness = useMemo(
    () => getTransitionReadiness(computed, rankedOptions),
    [computed, rankedOptions]
  );
  const nextActions = useMemo(
    () => getTransitionNextActions(stage, computed, rankedOptions),
    [stage, computed, rankedOptions]
  );
  const academicPreparation = useMemo(
    () =>
      getTransitionAcademicPreparation(stage, computed, rankedOptions, state),
    [stage, computed, rankedOptions, state]
  );
  const learningPlan = useMemo(
    () => getTransitionLearningPlan(stage, academicPreparation, state),
    [stage, academicPreparation, state]
  );
  const transitionSubjects = useMemo(
    () => [
      ...new Set(
        computed.options
          .flatMap(option =>
            option.requiredSubjects.map(required => required.subject.trim())
          )
          .filter(Boolean)
      ),
    ],
    [computed.options]
  );
  const dailyCapacityMinutes = profileDailyCapacityMinutes(
    profile?.hoursPerDay ?? "1 hour"
  );
  const today = todayStr();
  const adaptiveExecution = useMemo(
    () =>
      getTransitionAdaptiveExecutionPlan(
        state,
        learningPlan,
        dailyCapacityMinutes,
        today
      ),
    [state, learningPlan, dailyCapacityMinutes, today]
  );
  const closedLoop = useMemo(
    () =>
      getTransitionClosedLoop(
        state,
        academicPreparation,
        learningPlan,
        adaptiveExecution,
        1,
        transitionSubjects
      ),
    [
      state,
      academicPreparation,
      learningPlan,
      adaptiveExecution,
      transitionSubjects,
    ]
  );

  if (!profile) return null;

  const recommendation =
    stage === "JHS"
      ? "Use this centre to prepare for SHS selection. Student OS keeps your current JHS identity until graduation is confirmed."
      : stage === "SHS"
        ? "Use this centre to turn WASSCE results into a careful tertiary decision. Requirements and cut-offs must be re-verified from each institution before an application."
        : "Use this centre for the next academic chapter and keep official requirements attached to every decision.";

  const transitionTaskSource = (task: TransitionPreparationTask) =>
    `transition:${task.id}`;
  const taskAlreadyPromoted = (task: TransitionPreparationTask) =>
    state.tasks.some(item => item.sourceRef === transitionTaskSource(task));
  const promotePreparationTask = (task: TransitionPreparationTask) => {
    if (taskAlreadyPromoted(task)) return;
    addTask({
      title: task.title.trim(),
      description: `Preparation step from the Academic Journey transition hub (${stageLabel(stage)} → ${nextStage ? stageLabel(nextStage) : "next stage"}).`,
      subject: profile.subjects[0] ?? "Academic planning",
      dueDate: task.dueDate ?? "",
      priority: "medium",
      status: "todo",
      origin: "transition",
      sourceRef: transitionTaskSource(task),
    });
  };

  const promoteLearningPlan = () => {
    for (const step of learningPlan.steps) {
      if (state.tasks.some(task => task.sourceRef === step.sourceRef)) continue;
      addTask({
        title: step.title,
        description: `${step.description} Generated from the transition-aware learning plan.`,
        subject: step.subject,
        dueDate: "",
        priority: step.priority,
        status: "todo",
        origin: "transition",
        topicId: step.topicId,
        estimatedMinutes: step.duration,
        sourceRef: step.sourceRef,
      });
    }
  };

  const promoteAcademicPreparation = (
    item: ReturnType<typeof getTransitionAcademicPreparation>[number]
  ) => {
    if (state.tasks.some(task => task.sourceRef === item.sourceRef)) return;
    addTask({
      title: item.title,
      description: `${item.description} Generated from the transition-to-learning preparation bridge.`,
      subject: item.subject,
      dueDate: "",
      priority: item.priority,
      status: "todo",
      origin: "transition",
      ...(item.topicId ? { topicId: item.topicId } : {}),
      sourceRef: item.sourceRef,
    });
  };

  const promoteNextAction = (
    item: ReturnType<typeof getTransitionNextActions>[number]
  ) => {
    if (state.tasks.some(task => task.sourceRef === item.sourceRef)) return;
    addTask({
      title: item.title,
      description: `${item.description} Generated from the transition intelligence bridge.`,
      subject: profile.subjects[0] ?? "Academic planning",
      dueDate: "",
      priority: item.priority,
      status: "todo",
      origin: "transition",
      sourceRef: item.sourceRef,
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/journey">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Journey
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{stageLabel(stage)}</Badge>
              <Badge variant="outline">
                Next: {nextStage ? stageLabel(nextStage) : "Not configured"}
              </Badge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold">
              {getTransitionHeadline(stage)}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {recommendation}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">1. Results</h2>
            <p className="text-sm text-muted-foreground">
              Enter only results you actually have. Student OS does not invent
              missing grades.
            </p>
          </div>
          <Badge variant="outline">
            {hub.results.filter(item => item.grade).length} entered
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {hub.results.map(result => (
            <div
              key={result.id}
              className="grid gap-2 sm:grid-cols-[1.5fr_0.7fr_0.8fr_auto]"
            >
              <Input
                aria-label="Subject"
                value={result.subject}
                onChange={e =>
                  updateResult(result.id, { subject: e.target.value })
                }
                placeholder="Subject"
                className="h-10 rounded-xl"
              />
              <select
                aria-label="Category"
                value={result.category}
                onChange={e =>
                  updateResult(result.id, {
                    category: e.target.value as GradeResult["category"],
                  })
                }
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="core">Core</option>
                <option value="elective">Elective</option>
                <option value="other">Other</option>
              </select>
              <select
                aria-label="Grade"
                value={result.grade}
                onChange={e =>
                  updateResult(result.id, { grade: e.target.value })
                }
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="">Grade</option>
                {GRADES.map(grade => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeResult(result.id)}
                aria-label="Remove result"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-3" onClick={addResult}>
          <Plus className="mr-2 h-4 w-4" />
          Add result
        </Button>

        {stage === "SHS" ? (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Aggregate track
                <select
                  value={hub.aggregateTrack ?? "best_six"}
                  onChange={e =>
                    setHub(current => ({
                      ...current,
                      aggregateTrack: e.target
                        .value as TransitionDecisionHub["aggregateTrack"],
                    }))
                  }
                  className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="science">Science-related</option>
                  <option value="non_science">Non-science</option>
                  <option value="best_six">Best six entered</option>
                </select>
              </label>
            </div>
            {computed.aggregate !== undefined ? (
              <div className="mt-4 rounded-2xl bg-accent/60 p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    Calculated aggregate: {computed.aggregate}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculated locally from the currently entered results using
                  the selected six-subject track. Student OS labels this as a
                  local calculation, not an official institutional result or
                  published admission rule.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                Enter the required six-subject coverage for the selected track
                to calculate an aggregate.
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            {stage === "JHS"
              ? "BECE result capture is ready here; the official placement rules should be supplied by the active Ghana curriculum/placement data pack before Student OS labels a BECE aggregate as official."
              : "Enter results when the transition becomes relevant."}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              2. Options & eligibility
            </h2>
            <p className="text-sm text-muted-foreground">
              Save schools, programmes or universities you are considering, then
              attach the requirements Student OS should check.
            </p>
          </div>
          <Button variant="outline" onClick={addOption}>
            <Plus className="mr-2 h-4 w-4" />
            Add option
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {computed.options.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No options saved yet.
            </p>
          )}
          {computed.options.map(option => (
            <div key={option.id} className="rounded-2xl border p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={option.name}
                  onChange={e =>
                    updateOption(option.id, { name: e.target.value })
                  }
                  placeholder="Programme / school / university"
                  className="rounded-xl"
                />
                <select
                  value={option.type}
                  onChange={e =>
                    updateOption(option.id, {
                      type: e.target.value as TransitionDecisionOption["type"],
                    })
                  }
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="school">School</option>
                  <option value="programme">Programme</option>
                  <option value="university">University</option>
                  <option value="course">Course</option>
                </select>
                <Input
                  value={option.provider ?? ""}
                  onChange={e =>
                    updateOption(option.id, {
                      provider: e.target.value || undefined,
                    })
                  }
                  placeholder="Provider / institution"
                  className="rounded-xl"
                />
                <Input
                  value={option.sourceUrl ?? ""}
                  onChange={e =>
                    updateOption(option.id, {
                      sourceUrl: e.target.value || undefined,
                    })
                  }
                  placeholder="Source URL (https://...)"
                  className="rounded-xl"
                />
                <Input
                  value={option.requiredSubjects
                    .map(item => item.subject)
                    .join(", ")}
                  onChange={e =>
                    updateOption(option.id, {
                      requiredSubjects: e.target.value
                        .split(",")
                        .map(item => item.trim())
                        .filter(Boolean)
                        .map(subject => ({ subject })),
                    })
                  }
                  placeholder="Required subjects, comma-separated"
                  className="rounded-xl sm:col-span-2"
                />
                <Input
                  value={option.maxAggregate?.toString() ?? ""}
                  onChange={e =>
                    updateOption(option.id, {
                      maxAggregate: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="Maximum aggregate, if published"
                  type="number"
                  min={1}
                  max={100}
                  className="rounded-xl"
                />
                <select
                  value={option.confidence}
                  onChange={e =>
                    updateOption(option.id, {
                      confidence: e.target
                        .value as TransitionDecisionOption["confidence"],
                    })
                  }
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="learner_entered">Learner entered</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  {option.eligibility === "meets_stated_requirements" ? (
                    <span className="text-primary">
                      <CheckCircle2 className="mr-1 inline h-4 w-4" />
                      Meets stated requirements
                    </span>
                  ) : option.eligibility === "needs_review" ? (
                    <span className="text-muted-foreground">Needs review</span>
                  ) : (
                    <span className="text-muted-foreground">Not assessed</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(option.id)}
                  aria-label="Remove option"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {option.eligibilityReasons?.length ? (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {option.eligibilityReasons.map((reason, index) => (
                    <p key={index}>• {reason}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div>
          <h2 className="font-display text-lg font-bold">
            3. Student OS recommendation view
          </h2>
          <p className="text-sm text-muted-foreground">
            Options are ranked using only the requirements and results you
            entered. This is a planning signal, not a prediction of admission.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {rankedOptions.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Add an option above to see a transparent fit assessment.
            </p>
          ) : (
            rankedOptions.map(item => {
              const option = computed.options.find(
                candidate => candidate.id === item.optionId
              );
              if (!option) return null;
              return (
                <div key={item.optionId} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {option.name || "Unnamed option"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {option.provider || option.type}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {item.score}/100 · {item.fitBand.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {item.reasons.map((reason, index) => (
                      <p key={index}>• {reason}</p>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="border-primary/15 bg-primary/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              4. What Student OS thinks you should do next
            </h2>
            <p className="text-sm text-muted-foreground">
              This is an evidence-gated planning layer. It does not predict
              admission.
            </p>
          </div>
          <Badge variant="outline">{transitionReadiness.title}</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {transitionReadiness.detail}
        </p>
        <div className="mt-4 space-y-2">
          {nextActions.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No new transition action is required from the current information.
            </p>
          ) : (
            nextActions.map(item => {
              const promoted = state.tasks.some(
                task => task.sourceRef === item.sourceRef
              );
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border bg-background/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <Badge
                      variant={item.priority === "high" ? "default" : "outline"}
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant={promoted ? "secondary" : "outline"}
                    onClick={() => promoteNextAction(item)}
                    disabled={promoted}
                  >
                    {promoted ? (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        On task list
                      </>
                    ) : (
                      "Add to tasks"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="border-primary/15 bg-primary/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              5. Academic preparation bridge
            </h2>
            <p className="text-sm text-muted-foreground">
              Transition planning now connects to the same evidence and
              foundation system that powers your study plan.
            </p>
          </div>
          <Badge variant="outline">{academicPreparation.length} linked</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {academicPreparation.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No active foundation signal is currently connected to your saved
              transition requirements.
            </p>
          ) : (
            academicPreparation.map(item => {
              const promoted = state.tasks.some(
                task => task.sourceRef === item.sourceRef
              );
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border bg-background/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <Badge
                      variant={item.priority === "high" ? "default" : "outline"}
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{item.subject}</span>
                    {item.concept ? <span>· {item.concept}</span> : null}
                    {item.optionName ? (
                      <span>· supports {item.optionName}</span>
                    ) : null}
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant={promoted ? "secondary" : "outline"}
                    onClick={() => promoteAcademicPreparation(item)}
                    disabled={promoted}
                  >
                    {promoted ? (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        On task list
                      </>
                    ) : (
                      "Add academic prep to tasks"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="border-primary/15 bg-primary/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              6. Transition-aware learning plan
            </h2>
            <p className="text-sm text-muted-foreground">
              Turn the linked academic-preparation signal into an ordered
              learning path using the same prerequisite, evidence, practice and
              verification logic as Study.
            </p>
          </div>
          <Badge variant="outline">{learningPlan.steps.length} steps</Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {learningPlan.summary}
        </p>
        {learningPlan.steps.length ? (
          <>
            <div className="mt-4 space-y-2">
              {learningPlan.steps.map((step, index) => {
                const promoted = state.tasks.some(
                  task => task.sourceRef === step.sourceRef
                );
                return (
                  <div
                    key={step.id}
                    className="rounded-2xl border bg-background/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {index + 1}. {step.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                      <Badge variant="outline">{step.duration} min</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{step.subject}</span>
                      <span>· {step.action}</span>
                      <span>· {step.route}</span>
                    </div>
                    <Button
                      className="mt-3"
                      size="sm"
                      variant={promoted ? "secondary" : "outline"}
                      onClick={() => {
                        if (promoted) return;
                        addTask({
                          title: step.title,
                          description: `${step.description} Generated from the transition-aware learning plan.`,
                          subject: step.subject,
                          dueDate: "",
                          priority: step.priority,
                          status: "todo",
                          origin: "transition",
                          topicId: step.topicId,
                          estimatedMinutes: step.duration,
                          sourceRef: step.sourceRef,
                        });
                      }}
                      disabled={promoted}
                    >
                      {promoted ? (
                        <>
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          On task list
                        </>
                      ) : (
                        "Add step to tasks"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={promoteLearningPlan}
            >
              Build available steps into Tasks
            </Button>
          </>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            There is not enough topic-level learning evidence to build a
            reliable sequence yet.
          </p>
        )}
      </Card>

      <Card className="border-primary/15 bg-primary/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              7. Adaptive execution & closed loop
            </h2>
            <p className="text-sm text-muted-foreground">
              Schedule the evidence-linked preparation within your daily
              capacity, then require fresh evidence before Student OS closes the
              academic-preparation loop.
            </p>
          </div>
          <Badge variant="outline">
            {closedLoop.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <div className="mt-4 rounded-2xl border bg-background/60 p-4">
          <p className="font-semibold">{closedLoop.decision.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {closedLoop.decision.reason}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {closedLoop.remainingPreparation} repair signal
              {closedLoop.remainingPreparation === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              {closedLoop.remainingRechecks} recheck
              {closedLoop.remainingRechecks === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{adaptiveExecution.totalMinutes} min scheduled</span>
          </div>
        </div>
        {adaptiveExecution.steps.length ? (
          <div className="mt-4 space-y-2">
            {adaptiveExecution.steps.slice(0, 4).map((step, index) => (
              <div
                key={step.id}
                className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.date} · {step.mode.replaceAll("_", " ")}
                  </p>
                </div>
                <Badge variant="outline">{step.duration} min</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {adaptiveExecution.notes[0] ??
              "No transition execution block is scheduled yet."}
          </p>
        )}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          {closedLoop.notes[0]}
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              8. Transition checklist
            </h2>
            <p className="text-sm text-muted-foreground">
              Prepare before Student OS switches your academic environment.
            </p>
          </div>
          <Button variant="outline" onClick={addPreparationTask}>
            <Plus className="mr-2 h-4 w-4" />
            Add task
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {hub.preparationTasks.map(task => {
            const promoted = taskAlreadyPromoted(task);
            return (
              <div key={task.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={e =>
                      updateTask(task.id, { done: e.target.checked })
                    }
                    aria-label={task.title || "Complete task"}
                  />
                  <Input
                    value={task.title}
                    onChange={e =>
                      updateTask(task.id, { title: e.target.value })
                    }
                    placeholder="e.g. verify final result slip"
                    className="rounded-xl"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTask(task.id)}
                    aria-label="Remove task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {task.done
                      ? "Marked ready in the transition hub."
                      : "Promote this into your main task list so it can influence Today and recovery planning."}
                  </p>
                  <Button
                    size="sm"
                    variant={promoted ? "secondary" : "outline"}
                    onClick={() => promotePreparationTask(task)}
                    disabled={promoted || !task.title.trim()}
                  >
                    {promoted ? (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        On task list
                      </>
                    ) : (
                      "Add to tasks"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="border-primary/15 bg-primary/[0.04] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Decision safety</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Student OS will label evidence by confidence. It will not turn an
              estimate into a guaranteed admission outcome, and it will not
              change your academic identity until the progression step is
              explicitly confirmed.
            </p>
          </div>
        </div>
      </Card>

      <Button onClick={save} className="h-12 w-full rounded-xl">
        <Save className="mr-2 h-4 w-4" />
        {saved ? "Saved to your workspace" : "Save transition plan"}
      </Button>
    </div>
  );
}
