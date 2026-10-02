/* Student OS onboarding — required, curriculum-aware and entirely fresh. */

import WorkspaceBuilding from "@/components/WorkspaceBuilding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/StoreContext";
import { academicYearForNow } from "@/lib/academicJourney";
import {
  academicOfferingsFor,
  academicSelectionKindFor,
} from "@/lib/academicOfferings";
import {
  GHANA_NACCA_SECONDARY_CATALOGUE,
  subjectProvenanceForGhanaNaccaSecondary,
} from "@/lib/curriculumCatalogue";
import {
  prepareProfilePhoto,
  validateProfilePhotoFile,
} from "@/lib/profilePhoto";
import { trpc } from "@/lib/trpc";
import type { EducationLevel, StudentType } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Camera,
  Check,
  Plus,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";

const EDUCATION_LEVELS: Array<{
  value: EducationLevel;
  title: string;
  detail: string;
}> = [
  {
    value: "Primary",
    title: "Primary",
    detail: "Foundation learning and core skills",
  },
  {
    value: "Lower Secondary",
    title: "Lower Secondary",
    detail: "Early secondary school",
  },
  {
    value: "Secondary",
    title: "Secondary",
    detail: "Secondary school / high school",
  },
  {
    value: "Sixth Form / College",
    title: "Sixth Form / College",
    detail: "Pre-university or college studies",
  },
  {
    value: "Tertiary",
    title: "Tertiary",
    detail: "University or higher education",
  },
  { value: "Other", title: "Other", detail: "A different learning pathway" },
];

const GOAL_OPTIONS = [
  "Improve grades",
  "Prepare for exams",
  "Build better study habits",
  "Manage time",
  "Learn new skills",
  "Stay organized",
  "Save money better",
  "Reduce study stress",
];

const SHS_TRACK_OPTIONS = [
  "General Science",
  "General Arts",
  "Business",
  "Home Economics",
  "Visual Arts",
  "Agriculture",
  "Technical / STEM",
];

const HOUR_OPTIONS = ["30 minutes", "1 hour", "2 hours", "3 hours", "4+ hours"];
const ACADEMIC_CONTEXT_OPTIONS = [
  { countryCode: "GH", country: "Ghana", educationSystem: "NaCCA curriculum" },
  {
    countryCode: "OT",
    country: "Other / not listed",
    educationSystem: "Not specified",
  },
] as const;

function classOptionsFor(level: EducationLevel | null): string[] {
  switch (level) {
    case "Lower Secondary":
      return ["JHS 1", "JHS 2", "JHS 3"];
    case "Secondary":
      return ["SHS 1", "SHS 2", "SHS 3"];
    case "Primary":
      return [
        "Primary 1",
        "Primary 2",
        "Primary 3",
        "Primary 4",
        "Primary 5",
        "Primary 6",
      ];
    case "Sixth Form / College":
      return ["Year 1", "Year 2"];
    case "Tertiary":
      return [
        "Level 100",
        "Level 200",
        "Level 300",
        "Level 400",
        "Level 500",
        "Level 600",
      ];
    default:
      return ["Not specified yet"];
  }
}

function studentTypeFor(level: EducationLevel): StudentType {
  if (
    level === "Primary" ||
    level === "Lower Secondary" ||
    level === "Secondary"
  )
    return "Secondary School";
  if (level === "Sixth Form / College") return "College";
  if (level === "Tertiary") return "University";
  return "Other";
}

export default function Onboarding() {
  const { markOnboarded, setProfile } = useStore();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [educationSystem, setEducationSystem] = useState<string | null>(null);
  const [educationLevel, setEducationLevel] = useState<EducationLevel | null>(
    null
  );
  const [classLevel, setClassLevel] = useState("");
  const [academicTrack, setAcademicTrack] = useState("");
  const [academicYear, setAcademicYear] = useState(academicYearForNow());
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [useGhanaNaccaCatalogue, setUseGhanaNaccaCatalogue] = useState(false);
  const [hours, setHours] = useState<string | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(
    null
  );
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(
    null
  );
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoPreparationRef = useRef(0);
  const onboardingFinishClaimRef = useRef(false);
  const uploadProfilePhoto = trpc.profilePhoto.upload.useMutation();
  const academicOfferings = academicOfferingsFor(educationLevel ?? "Other");

  const toggleGoal = (goal: string) =>
    setSelectedGoals(previous =>
      previous.includes(goal)
        ? previous.filter(item => item !== goal)
        : [...previous, goal]
    );
  const toggleSubject = (subject: string) =>
    setSubjects(previous =>
      previous.includes(subject)
        ? previous.filter(item => item !== subject)
        : [...previous, subject]
    );
  const addCustomSubject = () => {
    const value = customSubject.trim();
    if (value)
      setSubjects(previous =>
        previous.some(
          subject => subject.toLocaleLowerCase() === value.toLocaleLowerCase()
        )
          ? previous
          : [...previous, value]
      );
    setCustomSubject("");
  };

  const chooseProfilePhoto = async (file?: File) => {
    if (!file) return;
    const error = validateProfilePhotoFile(file);
    if (error) {
      setProfilePhotoError(error);
      return;
    }
    const preparationId = profilePhotoPreparationRef.current + 1;
    profilePhotoPreparationRef.current = preparationId;
    setIsPreparingPhoto(true);
    try {
      const prepared = await prepareProfilePhoto(file);
      if (profilePhotoPreparationRef.current !== preparationId) return;
      setProfilePhotoDataUrl(prepared.dataUrl);
      setProfilePhotoError(null);
    } catch (compressionError) {
      if (profilePhotoPreparationRef.current !== preparationId) return;
      setProfilePhotoError(
        compressionError instanceof Error
          ? compressionError.message
          : "We could not prepare that image. Please choose another one."
      );
    } finally {
      if (profilePhotoPreparationRef.current === preparationId)
        setIsPreparingPhoto(false);
    }
  };

  const finish = async () => {
    if (onboardingFinishClaimRef.current) return;
    onboardingFinishClaimRef.current = true;
    const level = educationLevel ?? "Other";
    const displayName = name.trim();
    setIsUploadingPhoto(true);
    try {
      const profilePhotoStorageKey = profilePhotoDataUrl
        ? (
            await uploadProfilePhoto.mutateAsync({
              dataUrl: profilePhotoDataUrl,
            })
          ).storageKey
        : undefined;
      const accepted = setProfile({
        name: displayName,
        age: Number.parseInt(age, 10),
        educationLevel: level,
        ...(classLevel ? { classLevel } : {}),
        ...(academicTrack ? { academicTrack } : {}),
        ...(academicYear ? { academicYear } : {}),
        studentType: studentTypeFor(level),
        academicSelectionKind: academicSelectionKindFor(level),
        ...(countryCode ? { countryCode } : {}),
        ...(educationSystem ? { educationSystem } : {}),
        goals: selectedGoals.length ? selectedGoals : ["Stay organized"],
        subjects,
        hoursPerDay: hours ?? "1 hour",
        ...(useGhanaNaccaCatalogue
          ? {
              curriculumContext: {
                countryCode: GHANA_NACCA_SECONDARY_CATALOGUE.countryCode,
                educationSystem:
                  GHANA_NACCA_SECONDARY_CATALOGUE.educationSystem,
                catalogueId: GHANA_NACCA_SECONDARY_CATALOGUE.id,
                catalogueVersion: GHANA_NACCA_SECONDARY_CATALOGUE.version,
                sourceUrl: GHANA_NACCA_SECONDARY_CATALOGUE.sourceUrl,
              },
              subjectProvenance:
                subjectProvenanceForGhanaNaccaSecondary(subjects),
            }
          : {}),
        ...(profilePhotoStorageKey ? { profilePhotoStorageKey } : {}),
      });
      if (!accepted || !markOnboarded(displayName)) {
        onboardingFinishClaimRef.current = false;
        setProfilePhotoError(
          "We could not save those profile details. Check the information and try again."
        );
        setStep(0);
        return;
      }
      // Show the workspace-building animation before navigating to the dashboard.
      setBuilding(true);
    } catch {
      onboardingFinishClaimRef.current = false;
      setProfilePhotoError(
        "We could not save that image. You can choose another one or continue without a photo."
      );
      setStep(0);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const cannotContinue =
    (step === 0 &&
      (!name.trim() || !Number.parseInt(age, 10) || isPreparingPhoto)) ||
    (step === 1 && !countryCode) ||
    (step === 2 && !educationLevel) ||
    (step === 3 && !classLevel) ||
    (step === 5 && subjects.length === 0) ||
    (step === 6 && !hours);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-2.5 px-6 pt-6">
        <img src="/logo.svg" alt="Student OS" className="h-10 w-10" />
        <div className="leading-tight">
          <div className="font-display text-xl font-bold tracking-tight">
            Student <span className="text-primary">OS</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Your entire student life. In one place.
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10">
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all ${index === step ? "w-6 bg-primary" : index < step ? "w-3 bg-primary/45" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <div className="mt-8 flex-1">
          {step === 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Let&apos;s personalise your workspace
              </p>
              <h1 className="font-display text-3xl font-bold">
                What should we call you?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your name is saved only in your private Student OS workspace to
                make your plan feel personal.
              </p>
              <Input
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. Alex"
                className="mt-6 h-12 rounded-xl bg-card text-base"
              />
              <p className="mt-7 text-sm font-medium">And how old are you?</p>
              <Input
                type="number"
                inputMode="numeric"
                min={6}
                max={99}
                value={age}
                onChange={event => setAge(event.target.value)}
                placeholder="e.g. 16"
                className="mt-2 h-12 rounded-xl bg-card text-base"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                This helps us choose age-appropriate lesson language and
                examples.
              </p>
              <div className="mt-7 rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  {profilePhotoDataUrl ? (
                    <img
                      src={profilePhotoDataUrl}
                      alt="Selected profile preview"
                      className="h-14 w-14 rounded-2xl border border-primary/20 object-cover"
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Camera className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      Add a profile picture{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      PNG, JPEG, or WebP · any source size. We automatically
                      optimize it into a fast, private avatar.
                    </p>
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={event => {
                    void chooseProfilePhoto(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl bg-card"
                    disabled={isPreparingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {isPreparingPhoto
                      ? "Optimizing photo…"
                      : profilePhotoDataUrl
                        ? "Choose another"
                        : "Choose photo"}
                  </Button>
                  {profilePhotoDataUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 rounded-xl text-muted-foreground"
                      onClick={() => {
                        setProfilePhotoDataUrl(null);
                        setProfilePhotoError(null);
                        if (photoInputRef.current)
                          photoInputRef.current.value = "";
                      }}
                    >
                      <X className="mr-1.5 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                {isPreparingPhoto && (
                  <p
                    role="status"
                    className="mt-2 text-xs font-medium text-muted-foreground"
                  >
                    Preparing a smaller, faster profile picture…
                  </p>
                )}
                {profilePhotoError && (
                  <p
                    role="alert"
                    className="mt-2 text-xs font-medium text-destructive"
                  >
                    {profilePhotoError}
                  </p>
                )}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Your academic context
              </p>
              <h1 className="font-display text-3xl font-bold">
                Where do you study?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This helps Student OS choose a verified catalogue when one is
                available. You can always add custom subjects.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                {ACADEMIC_CONTEXT_OPTIONS.map(option => (
                  <button
                    key={option.countryCode}
                    aria-pressed={countryCode === option.countryCode}
                    onClick={() => {
                      setCountryCode(option.countryCode);
                      setEducationSystem(option.educationSystem);
                      if (option.countryCode !== "GH")
                        setUseGhanaNaccaCatalogue(false);
                    }}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition-all ${countryCode === option.countryCode ? "border-primary bg-primary/10 ring-1 ring-primary/25" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    <span className="flex items-center justify-between gap-3 font-semibold">
                      <span>{option.country}</span>
                      {countryCode === option.countryCode && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {option.educationSystem}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Your learning level
              </p>
              <h1 className="font-display text-3xl font-bold">
                Where are you in your education?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Daily Lessons will match the depth and vocabulary to this level.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                {EDUCATION_LEVELS.map(level => (
                  <button
                    key={level.value}
                    aria-pressed={educationLevel === level.value}
                    onClick={() => {
                      setEducationLevel(level.value);
                      setClassLevel("");
                      setAcademicTrack("");
                      setSubjects([]);
                      setCustomSubject("");
                      if (level.value !== "Secondary")
                        setUseGhanaNaccaCatalogue(false);
                    }}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition-all ${educationLevel === level.value ? "border-primary bg-primary/10 ring-1 ring-primary/25" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    <span className="flex items-center justify-between gap-3 font-semibold">
                      <span>{level.title}</span>
                      {educationLevel === level.value && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {level.detail}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Your current stage
              </p>
              <h1 className="font-display text-3xl font-bold">
                Which class or year are you in?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This is critical. Student OS will tune the journey, curriculum
                depth and graduation timing to your actual stage.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {classOptionsFor(educationLevel).map(option => (
                  <button
                    key={option}
                    aria-pressed={classLevel === option}
                    onClick={() => setClassLevel(option)}
                    className={`rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-all ${classLevel === option ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/25" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {educationLevel === "Secondary" ? (
                <div className="mt-5">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Programme / track
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This helps Student OS tune lessons and planning to your SHS
                    pathway.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {SHS_TRACK_OPTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={academicTrack === option}
                        onClick={() => setAcademicTrack(option)}
                        className={`rounded-full border px-3 py-2 text-sm ${academicTrack === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-5">
                <label
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  htmlFor="academic-year"
                >
                  Academic year
                </label>
                <Input
                  id="academic-year"
                  value={academicYear}
                  onChange={event => setAcademicYear(event.target.value)}
                  placeholder="2026/27"
                  className="mt-2 h-11 rounded-xl bg-card"
                />
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Your intention
              </p>
              <h1 className="font-display text-3xl font-bold">
                What would you like Student OS to help with?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose as many as fit. You can change these later.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {GOAL_OPTIONS.map(goal => (
                  <button
                    key={goal}
                    aria-pressed={selectedGoals.includes(goal)}
                    onClick={() => toggleGoal(goal)}
                    className={`rounded-full border px-4 py-2 text-sm transition-all ${selectedGoals.includes(goal) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 5 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Your {academicOfferings.pluralLabel}
              </p>
              <h1 className="font-display text-3xl font-bold">
                {academicOfferings.heading}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {academicOfferings.supportingText}
              </p>
              {countryCode === "GH" && educationLevel === "Secondary" && (
                <button
                  type="button"
                  aria-pressed={useGhanaNaccaCatalogue}
                  onClick={() => setUseGhanaNaccaCatalogue(current => !current)}
                  className={`mt-4 w-full rounded-2xl border p-3.5 text-left transition-all ${useGhanaNaccaCatalogue ? "border-primary bg-primary/10 ring-1 ring-primary/25" : "border-border bg-card hover:border-primary/40"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold">
                        Use the Ghana NaCCA secondary catalogue
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        Optional. Matching subjects are marked with this cited
                        catalogue version; anything else you add stays custom.
                      </span>
                    </span>
                    {useGhanaNaccaCatalogue && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </span>
                  <span className="mt-2 block text-xs text-primary underline">
                    Source: NaCCA Secondary Education Curriculum
                  </span>
                </button>
              )}
              <div className="mt-6 space-y-5">
                {(useGhanaNaccaCatalogue
                  ? [
                      {
                        title: "Ghana NaCCA secondary subjects",
                        offerings: Array.from(
                          new Set([
                            ...GHANA_NACCA_SECONDARY_CATALOGUE.subjects.map(
                              subject => subject.name
                            ),
                            ...academicOfferings.groups.flatMap(
                              group => group.offerings
                            ),
                          ])
                        ),
                      },
                    ]
                  : academicOfferings.groups
                ).map(group => (
                  <section key={group.title} aria-label={group.title}>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {group.title}
                    </h2>
                    <div className="mt-2.5 flex flex-wrap gap-2.5">
                      {group.offerings.map(subject => (
                        <button
                          key={subject}
                          aria-pressed={subjects.includes(subject)}
                          onClick={() => toggleSubject(subject)}
                          className={`rounded-full border px-3.5 py-2 text-sm transition-all ${subjects.includes(subject) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"}`}
                        >
                          {subject}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Plus className="h-4 w-4 text-primary" />{" "}
                  {academicOfferings.customLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {academicOfferings.customHint}
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={customSubject}
                    onChange={event => setCustomSubject(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomSubject();
                      }
                    }}
                    placeholder={`Type a ${academicOfferings.selectionLabel}`}
                    className="h-10 rounded-xl bg-card"
                  />
                  <Button
                    variant="sunrise"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={addCustomSubject}
                    aria-label={`Add custom ${academicOfferings.selectionLabel}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {subjects.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {subjects.map(subject => (
                    <Badge
                      key={subject}
                      variant="secondary"
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                    >
                      {subject}
                      <button
                        onClick={() => toggleSubject(subject)}
                        className="ml-1.5 opacity-60 hover:opacity-100"
                        aria-label={`Remove ${subject}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === 7 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                A realistic rhythm
              </p>
              <h1 className="font-display text-3xl font-bold">
                How much time can you study each day?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                A sustainable plan wins over cramming.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {HOUR_OPTIONS.map(option => (
                  <button
                    key={option}
                    aria-pressed={hours === option}
                    onClick={() => setHours(option)}
                    className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition-all ${hours === option ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 7 && (
            <section className="pt-4 text-center">
              {building ? (
                <WorkspaceBuilding
                  subjects={subjects}
                  level={educationLevel ?? "Other"}
                  onDone={() => navigate("/")}
                />
              ) : (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <BookOpenCheck className="h-8 w-8" />
                  </div>
                  <h1 className="mt-6 font-display text-3xl font-bold">
                    Your workspace is ready.
                  </h1>
                  <p className="mt-3 text-sm text-muted-foreground">
                    We&apos;ll create Daily Lessons for{" "}
                    <strong className="text-foreground">
                      {subjects.join(", ")}
                    </strong>{" "}
                    at{" "}
                    <strong className="text-foreground">
                      {educationLevel}
                    </strong>{" "}
                    level.
                  </p>
                  <div className="mt-8 rounded-2xl bg-accent/60 p-4 text-left text-sm text-accent-foreground">
                    Every lesson is tailored to your selected subjects. You can
                    ask a follow-up question whenever you need help.
                  </div>
                  <div className="mt-8 flex flex-col gap-3">
                    <Button
                      variant="sunrise"
                      className="h-14 text-base"
                      disabled={isUploadingPhoto}
                      onClick={() => void finish()}
                    >
                      {isUploadingPhoto
                        ? "Saving your picture…"
                        : "Build my workspace"}{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        {step < 7 && (
          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button
                variant="outline"
                className="h-12 rounded-xl"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            <Button
              variant="sunrise"
              className="h-12 flex-1 text-base"
              disabled={cannotContinue}
              onClick={() => setStep(step + 1)}
            >
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
        {step === 7 && (
          <Button
            variant="ghost"
            className="mt-4 self-center text-muted-foreground"
            onClick={() => setStep(5)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Change my choices
          </Button>
        )}
      </div>
    </div>
  );
}
