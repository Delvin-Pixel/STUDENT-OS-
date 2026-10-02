# Reliability Audit Findings

## Startup and Chrome/PWA persistence

The preview opens directly to the essential profile setup, including the optional profile-picture picker, when its current device-local workspace is empty. The reported old-account screen is driven by the `studentos:data:v2` browser key, which the prior no-sign-in release continued to restore. The current remediation moves live state to `studentos:data:v3`, clears pre-release workspace keys once, and refreshes the installed-app cache under `studentos-v4`. A synthetic v2 workspace was placed into the browser for final migration verification.

The synthetic legacy workspace was reloaded in the browser after the migration change. It opened profile setup instead of the old dashboard, confirming that a pre-release Chrome workspace is no longer restored. The first setup step accepts a name and age and visibly offers the optional profile-picture picker. Its hidden native file input accepts PNG, JPEG, and WebP; browser automation cannot attach to that hidden control, while the client/server validators and upload contract are covered by automated tests.

## Onboarding workflow

The full setup route was completed with a secondary-school profile, two goals, Mathematics and Science, and a custom Robotics subject. The custom-subject control added the subject correctly, the summary accurately reflected all three subjects and the selected level, and the final workspace-build entry point was reachable. The flow showed no routing error or stale profile restoration during this pass.

## Dashboard and lesson startup

The dashboard loaded immediately after workspace creation with the selected profile and current daily-goal tracker. The lesson preparation animation resolved into a complete Mathematics lesson within the next render cycle, including objectives, teaching content, a quick check, save, completion, and follow-up-question controls. A transient local teaching scaffold was used after the lesson-service timeout rather than leaving the learner on an indefinite loading screen.

## Reminder settings

The reminders control was exercised in the embedded preview. The browser did not grant notification permission in this context, and Student OS kept the switch disabled while showing the correct normal-browser guidance instead of claiming that reminders were enabled. This is an expected preview limitation; a real installed-phone push delivery remains the final user-side check. The settings page contained outdated account and signed-in-device wording, which has been corrected to explain the device-local workspace and backup model.

## Notification audit status

The existing development console includes an earlier Daily Lessons AI timeout warning. It is a recoverable fallback path, not a startup failure. Notification permission and delivery still require a real installed mobile browser for final verification after the local workspace migration is confirmed.

## Task workflow

The task-creation workflow was exercised in the audited browser profile. A task with a title, description, due date, and default priority/status was accepted, the modal closed, and the new task appeared immediately in the list with the correct due date and state controls. The task incremented the app's in-workspace activity indicator without a console or navigation error.

Marking that task complete updated its completion control and visual treatment immediately, awarded 10 XP, and changed the current streak from zero to one day. This confirms that task completion, activity logging, gamification, and streak state are connected in the browser flow.

The Study Planner accepted a configured subject, topic, future date, time, duration, priority, difficulty, and notes. The submitted session appeared immediately as planned with its expected Science subject, date, duration, status actions, and notes. No console, validation, or navigation defect was observed in this path.

The Focus Timer rendered its presets, custom configuration entry point, optional subject selector, reset control, and daily/weekly summaries. Starting the default session immediately transitioned the control to Pause and decremented the timer from 25:00 to 24:59 without an error. Full finish-notification delivery remains a real-device verification item because it requires waiting for a scheduled interval and an approved phone permission.

The Flashcards workflow created the representative “Cell division essentials” deck immediately and rendered its card count, review control, add-card entry point, and delete-deck control. No validation or rendering failure was observed during deck creation.

The new-card dialog accepted question-and-answer content, created the card successfully, and updated the deck count from zero to one. The deck’s Review control became active, confirming the standard create-to-study progression.

Review mode rendered the question first, flipped cleanly to the answer, and updated completion from 0/1 to 1/1 after an Easy response. This verifies the basic review interaction and progress tracking path.

The Notes workspace accepted a title and body, saved the note successfully, and immediately rendered the saved entry with edit, pin, and delete controls. No creation or presentation defect was observed.

The Exam Center accepted a configured subject, title, future date, time, location, and notes. It rendered the expected 25-day countdown, then accepted a revision topic and showed the readiness state as 0/1 mastered. No exam-creation or revision-topic defect was observed.

The Progress view rendered persisted XP, streak, weekly time, goal, chart, and achievement states without runtime errors. Goals correctly presented an encouraging empty state and accessible creation actions when no goals were present.

The Goals workspace created an active target with a future deadline, accurately reported its 0/2 initial state, and converted it to a completed 2/2 goal after the completion action. XP updated from 10 to 60 and the goal offered a reopen control. No goal-state defect was observed.

The Budget workspace accepted a dated expense, updated spend and balance totals to 12.50 and -12.50 respectively, rendered the category chart, and listed the transaction with deletion control. No transaction or aggregation defect was observed.

The Study Assistant accepted a distinct active-recall question and returned a relevant fresh response, labeled only as “Student OS tutor.” The tested assistant conversation had no stale-answer or source-label defect.

## Profile-picture persistence

A minimal valid PNG was selected through the initial setup picker, then the complete setup flow was finished. The resulting Settings workspace renders the saved picture from the managed profile-photo storage path beside the new “Photo Audit” profile. This confirms positive client selection, server validation/upload, local profile persistence, and workspace display in one browser journey.

## Installed-app readiness

The audited HTTPS preview is a secure context with an active service worker and no waiting worker. The only active workspace key is `studentos:data:v3`, alongside the independent lesson cache, which confirms that the legacy v2 workspace is not being restored. Browser notification permission remains `default` in this preview environment; subscription permission and end-to-end delivery therefore still require the student’s real phone browser.

## Mobile first-run visual audit

Eight mobile-sized route captures, each using a clean browser context, all opened the required first-run profile setup rather than a legacy account or sign-in screen. The portrait layout keeps the name, age, optional profile-picture control, supporting privacy copy, and Continue action visible and usable without clipping.

## Timetable workflow

The Timetable route opened against the configured device-local workspace with a clear empty state and both primary add-event actions. Its event form exposed title, day, type, start/end time, optional subject, and location controls without rendering or navigation errors. Submission validation and persistence remain in the active audit pass.

The event form accepted a Mathematics revision class on Monday from 16:00 to 17:00 with a Library location. Submission closed the form, raised the in-app activity counter, and immediately rendered the event in the Monday schedule with edit and delete controls. No persistence or layout defect was observed.
