import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/StoreContext";
import {
  academicYearForNow,
  evaluateAcademicJourney,
  nextAcademicStage,
  stageLabel,
} from "@/lib/academicJourney";
import type { EducationLevel, Profile } from "@/lib/types";
import { todayStr } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const classOptions: Record<EducationLevel, string[]> = {
  Primary: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  "Lower Secondary": ["JHS 1", "JHS 2", "JHS 3"],
  Secondary: ["SHS 1", "SHS 2", "SHS 3"],
  "Sixth Form / College": ["Year 1", "Year 2"],
  Tertiary: [
    "Level 100",
    "Level 200",
    "Level 300",
    "Level 400",
    "Level 500",
    "Level 600",
  ],
  Other: ["Not specified yet"],
};

function educationLevelForStage(
  stage: ReturnType<typeof nextAcademicStage>
): EducationLevel {
  if (stage === "JHS") return "Lower Secondary";
  if (stage === "SHS") return "Secondary";
  if (stage === "Tertiary") return "Tertiary";
  return "Other";
}

export default function Journey() {
  const { state, confirmAcademicGraduation } = useStore();
  const profile = state.profile;
  const journey = state.academicJourney;
  const [nextClass, setNextClass] = useState("");
  const [nextSubjects, setNextSubjects] = useState("");

  const evaluated = useMemo(
    () => (journey ? evaluateAcademicJourney(journey) : undefined),
    [journey]
  );

  if (!profile || !evaluated) return null;

  const nextStage =
    evaluated.transition?.to ?? nextAcademicStage(evaluated.current.stage);
  const nextLevel = educationLevelForStage(nextStage);
  const readyToConfirm =
    evaluated.current.status === "awaiting_confirmation" &&
    Boolean(nextStage) &&
    Boolean(nextClass.trim()) &&
    Boolean(nextSubjects.trim());

  const confirm = () => {
    if (!readyToConfirm || !nextStage) return;
    const nextProfile: Profile = {
      ...profile,
      educationLevel: nextLevel,
      studentType:
        nextLevel === "Tertiary"
          ? "University"
          : nextLevel === "Secondary" || nextLevel === "Lower Secondary"
            ? "Secondary School"
            : profile.studentType,
      academicSelectionKind: nextLevel === "Tertiary" ? "course" : "subject",
      classLevel: nextClass.trim(),
      academicYear: evaluated.current.expectedCompletionYear
        ? `${evaluated.current.expectedCompletionYear}/${String(evaluated.current.expectedCompletionYear + 1).slice(-2)}`
        : academicYearForNow(),
      subjects: nextSubjects
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 30),
    };
    confirmAcademicGraduation(nextProfile);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Academic Journey
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">
              Your next chapter is being prepared.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Student OS keeps your completed stage as history and will only
              change your current academic identity after you confirm the
              transition.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">
                Current: {stageLabel(evaluated.current.stage)}
              </Badge>
              {evaluated.current.classLevel ? (
                <Badge variant="outline">{evaluated.current.classLevel}</Badge>
              ) : null}
              {evaluated.current.expectedCompletionYear ? (
                <Badge variant="outline">
                  Expected completion:{" "}
                  {evaluated.current.expectedCompletionYear}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {evaluated.current.status === "awaiting_confirmation" ? (
        <Card className="border-primary/25 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">
                Congratulations, {profile.name}! 🎉
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Student OS detected that your{" "}
                {stageLabel(evaluated.current.stage)} journey is at a transition
                point. Confirm the graduation first; then we'll switch your
                environment to{" "}
                {nextStage ? stageLabel(nextStage) : "your next stage"}.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Your next class / year
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(classOptions[nextLevel] ?? []).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setNextClass(option)}
                    aria-pressed={nextClass === option}
                    className={`rounded-full border px-3 py-2 text-sm ${nextClass === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                htmlFor="next-subjects"
              >
                Next subjects / courses
              </label>
              <Input
                id="next-subjects"
                value={nextSubjects}
                onChange={e => setNextSubjects(e.target.value)}
                className="mt-2 h-11 rounded-xl"
                placeholder={
                  nextLevel === "Tertiary"
                    ? "e.g. Information Technology, Statistics"
                    : "e.g. Physics, Chemistry, Mathematics"
                }
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Separate multiple choices with commas. You can refine them
                later.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-accent/60 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Before the switch, your next-stage preparation should include
                results, aggregate calculation, eligibility checks,
                school/programme decisions and application planning.
              </p>
            </div>
          </div>

          <Button
            className="mt-5 h-12 w-full rounded-xl"
            disabled={!readyToConfirm}
            onClick={confirm}
          >
            Confirm graduation & enter{" "}
            {nextStage ? stageLabel(nextStage) : "next stage"}{" "}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">
                Journey status: {evaluated.current.status.replaceAll("_", " ")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Student OS is continuing to personalize your current academic
                stage. Next evaluation uses your class, academic year and
                confirmed transitions.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Academic history</h2>
        <div className="mt-3 space-y-2">
          {evaluated.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your completed stages will appear here and remain part of your
              long-term Student OS record.
            </p>
          ) : (
            evaluated.history.map((record, index) => (
              <div
                key={`${record.stage}-${index}`}
                className="rounded-xl border p-3"
              >
                <div className="font-semibold">{stageLabel(record.stage)}</div>
                <div className="text-xs text-muted-foreground">
                  {record.classLevel ?? "Stage completed"} ·{" "}
                  {record.completedAt?.slice(0, 10) ?? todayStr()}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" asChild className="rounded-xl bg-card">
          <Link href="/transition">Open transition decision hub</Link>
        </Button>
        <Button variant="outline" asChild className="rounded-xl bg-card">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
