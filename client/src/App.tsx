/* STUDENT OS — Daybreak Workspace. Light, warm, mobile-first PWA shell.
   An authenticated account gates every workspace; each device restores that
   account's cloud-backed, local-first workspace before routes are rendered. */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GraduationCap, Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { useAuth } from "./_core/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import PushReminderSync from "./components/PushReminderSync";
import { Button } from "./components/ui/button";
import { startLogin } from "./const";
import { StoreProvider, useStore } from "./contexts/StoreContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { getAuthenticatedLocationWithoutOAuthError } from "./lib/oauthLocation";
import { getStartupView } from "./lib/startupRouting";

const Study = lazy(() => import("./pages/Study"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AppShell = lazy(() => import("./components/AppShell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Focus = lazy(() => import("./pages/Focus"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const Timetable = lazy(() => import("./pages/Timetable"));
const Exams = lazy(() => import("./pages/Exams"));
const Progress = lazy(() => import("./pages/Progress"));
const Goals = lazy(() => import("./pages/Goals"));
const Budget = lazy(() => import("./pages/Budget"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Notes = lazy(() => import("./pages/Notes"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Quizzes = lazy(() => import("./pages/Quizzes"));
const Mastery = lazy(() => import("./pages/Mastery"));
const QuizDrafts = lazy(() => import("./pages/QuizDrafts"));
const StudyMaterials = lazy(() => import("./pages/StudyMaterials"));
const Reviews = lazy(() => import("./pages/Reviews"));
const MaterialSummary = lazy(() => import("./pages/MaterialSummary"));
const Today = lazy(() => import("./pages/Today"));
const Journey = lazy(() => import("./pages/Journey"));
const Transition = lazy(() => import("./pages/Transition"));
const Foundation = lazy(() => import("./pages/Foundation"));
const SavedLessons = lazy(() => import("./components/SavedLessons"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function Root() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" switchable>
        <TooltipProvider>
          <Toaster position="bottom-center" />
          <AuthenticatedStudentOS />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AuthenticatedStudentOS() {
  const { user, loading, error } = useAuth();
  const [loginStarting, setLoginStarting] = useState(false);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const replacementPath = getAuthenticatedLocationWithoutOAuthError(
      window.location.href
    );
    if (replacementPath) {
      window.history.replaceState(window.history.state, "", replacementPath);
    }
  }, [user]);

  const handleLogin = async () => {
    if (loginStarting) return;
    setLoginStarting(true);
    const started = await startLogin();
    if (!started) setLoginStarting(false);
  };
  if (loading)
    return <WorkspaceLoading label="Checking your Student OS account…" />;
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-sm text-center" aria-busy={loginStarting}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {loginStarting ? (
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
            ) : (
              <GraduationCap className="h-8 w-8" aria-hidden="true" />
            )}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Your Student OS
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Welcome to Student OS
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            One secure workspace, wherever you study.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            New students set up a private workspace after authentication.
            Returning students restore their existing workspace automatically.
          </p>
          {loginStarting ? (
            <p
              className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-primary"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Connecting securely…
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              We could not check your session. Please try again.
            </p>
          ) : null}
          <div className="mt-6 grid gap-3 text-left">
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
              <p className="text-sm font-semibold">New to Student OS?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your account and continue to your personal setup.
              </p>
              <Button
                className="mt-3 h-11 w-full rounded-xl"
                onClick={handleLogin}
                disabled={loginStarting}
                aria-label={
                  loginStarting ? "Connecting securely" : "Create an account"
                }
              >
                {loginStarting ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Connecting…
                  </>
                ) : (
                  "Create an account"
                )}
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Already have an account?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Log in to restore your saved Student OS workspace.
              </p>
              <Button
                variant="outline"
                className="mt-3 h-11 w-full rounded-xl bg-card"
                onClick={handleLogin}
                disabled={loginStarting}
                aria-label={loginStarting ? "Connecting securely" : "Log in"}
              >
                {loginStarting ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Connecting…
                  </>
                ) : (
                  "Log in"
                )}
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }
  return (
    <StoreProvider key={user.openId} openId={user.openId}>
      <Router />
    </StoreProvider>
  );
}

function Router() {
  const { state, workspaceReady } = useStore();
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(state.settings.theme);
  }, [setTheme, state.settings.theme]);
  const startupView = getStartupView(state, workspaceReady);
  if (startupView === "loading")
    return <WorkspaceLoading label="Preparing your Student OS…" />;
  if (startupView === "onboarding")
    return (
      <Suspense fallback={<RouteLoading />}>
        <Onboarding />
      </Suspense>
    );
  return (
    <>
      <PushReminderSync />
      <AppShell>
        <Suspense fallback={<RouteLoading />}>
          <Switch>
            <Route path={"/"} component={Dashboard} />
            <Route path={"/dashboard"} component={Dashboard} />
            <Route path={"/study"} component={Study} />
            <Route path={"/tasks"} component={Tasks} />
            <Route path={"/focus"} component={Focus} />
            <Route path={"/flashcards"} component={Flashcards} />
            <Route path={"/quizzes"} component={Quizzes} />
            <Route path={"/mastery"} component={Mastery} />
            <Route path={"/quiz-drafts"} component={QuizDrafts} />
            <Route path={"/ai-quiz"} component={QuizDrafts} />
            <Route path={"/ai-quiz/library"} component={Quizzes} />
            <Route path={"/materials"} component={StudyMaterials} />
            <Route path={"/reviews"} component={Reviews} />
            <Route path={"/material-summary"} component={MaterialSummary} />
            <Route path={"/today"} component={Today} />
            <Route path={"/journey"} component={Journey} />
            <Route path={"/transition"} component={Transition} />
            <Route path={"/foundation"} component={Foundation} />
            <Route path={"/notes"} component={Notes} />
            <Route path={"/saved"} component={SavedLessons} />
            <Route path={"/timetable"} component={Timetable} />
            <Route path={"/exams"} component={Exams} />
            <Route path={"/progress"} component={Progress} />
            <Route path={"/goals"} component={Goals} />
            <Route path={"/budget"} component={Budget} />
            <Route path={"/assistant"} component={Assistant} />
            <Route path={"/leaderboard"} component={Leaderboard} />
            <Route path={"/settings"} component={SettingsPage} />
            <Route path={"/feedback"} component={Feedback} />
            <Route path={"/notifications"} component={Notifications} />
            <Route path={"/404"} component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AppShell>
    </>
  );
}

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-6"
      aria-busy="true"
    >
      <div
        className="flex max-w-xs flex-col items-center text-center"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <GraduationCap className="h-8 w-8" aria-hidden="true" />
          <Loader2
            className="absolute -right-2 -top-2 h-5 w-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
        <p className="mt-5 font-display text-lg font-semibold text-foreground">
          {label}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your information is being kept private to your own workspace.
        </p>
      </div>
    </main>
  );
}

function RouteLoading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="h-6 w-6 animate-spin motion-reduce:animate-none text-primary"
        aria-label="Loading page"
      />
    </div>
  );
}

export default Root;
