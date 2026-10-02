# Saved Daily Lessons (bookmarks) — implementation notes

## Architecture (verified in code, 15 Aug)

- `client/src/components/DailyLesson.tsx`: renders today's lesson; uses `useStore()` from StoreContext for `state` + `completeDailyLesson`. Lesson data type: `DailyLessonData` from `server/lessons`. Lesson shape: title, strapline, learningGoals[], sections[{heading, explanation}], keyTerms[{term, definition}], diagram{title, nodes, connectors}, illustration{requested, url, caption}, workedExample{title, prompt, solution}, quickCheck{question, answer}. Local cache: localStorage key `studentos:dailyLessons:v1` keyed by selection.key.
- Selection: `chooseDailyTopic(profile.subjects, profile.educationLevel, todayStr())` returns `{ key, subject, branch, topic }` — deterministic per day.
- `client/src/contexts/StoreContext.tsx`: `StudyState` has `dailyLessonCompletions: string[]` (completed keys). `completeDailyLesson(lessonKey, lessonTitle)` at line 566. `exportStateFn = exportData(stateRef.current)` — cloud sync uploads the ENTIRE state object via `trpc.workspace.save({ workspace: payload })` (debounce 2.5s in `client/src/lib/workspaceSync.ts`), last-write-wins. So new collections just need to live in the StudyState object to sync automatically.
- `emptyState()` defines default shape (~line 210); `exportState/importState` (backup) at line 543/545 also handle the whole state.
- Storage local: `client/src/lib/storage.ts` with loadState/saveState (localStorage).
- `shared/types.ts` (server types file) — need to check whether StudyState is defined there or only client-side; backup import/export must include the new field.

## Plan

1. Add `savedLessons: SavedLesson[]` to StudyState (store state), `emptyState`, and the backup export/import in StoreContext.tsx.
2. New `SavedLesson` type: `{ id, dateStr, selectionKey, subject, branch, topic, title, strapline, savedAt }` (store compact: no full content needed — re-select from today's cache? NO — old lessons may no longer be cached. Keep full content compact: title, strapline, subject, branch, topic, dateStr, savedAt; optionally sections text). Decision: store `title, strapline, subject, branch, topic, dateStr, savedAt` + `lesson` compact copy of sections text + keyTerms + learningGoals (needed for review). Add `review` view showing title/metadata; full review could re-render from stored content.
3. Add actions to StoreContext: `saveDailyLesson(lesson, selection)` / `removeSavedLesson(id)` / `isLessonSaved(key)`; optimistic update + toast; upload handled automatically by sync (state changed).
4. DailyLesson.tsx: add Bookmark/BookmarkCheck toggle button next to "Mark lesson complete"; toast feedback.
5. Saved Lessons collection: add a new route or a tab in Study page. Simplest: new page `SavedLessons` at route `/saved` accessible from AppShell nav + a header entry on the Daily Lesson card ("Saved lessons (n)"). Check AppShell.tsx nav structure first.
6. Tests: server-side-ish unit tests for the helper (bookmark toggle logic) in `server/bookmarks.test.ts` (like existing welcome.recovery.test.ts pattern). Update `auth.logout.test.ts` only if state shape changed assumptions.
7. Build: memory pressure — kill chromium first. tsc + `pnpm test` + `pnpm build`. Then checkpoint (auto-publish), verify live bundle.

## Live site

- https://studentos-jmnrfmj9.manus.space — auto-publish enabled.
- Dev URL: https://3000-i4g0yeyauau00h8k01386z3-0817851f.us3.manus.computer (port 3000)

## Notes

- Do NOT store full sections content in workspace sync (blob may get large) — store metadata + short summary text. Lesson review shows stored summary.
- Existing test count: 17 files / 56 tests passing.
- Lesson cache localStorage `studentos:dailyLessons:v1` is per-device only; bookmarks must go in StudyState for cloud sync.
