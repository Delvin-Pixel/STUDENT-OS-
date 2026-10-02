# Student OS Product Upgrade Audit and Implementation Roadmap

## Audit scope and non-negotiable foundation

This audit compares the current implementation with the supplied connected-learning specification. It preserves the recently validated **authenticated, cloud-backed, local-first workspace**: identity is server-derived, each account has isolated browser cache keys and cloud data, and synchronization is revision-aware. Product work must extend the canonical workspace schema and its migration path; it must not reintroduce device-global data or bypass protected server procedures.

## Current capability map

| Product area                      | Present implementation                                                                                         | Gap relative to the specification                                                                                                                            | Priority   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Account, cloud, offline cache     | Account-gated workspace, account-scoped cache, cloud persistence, conflict merge, sync state                   | No product change required; every new record must use this existing lifecycle                                                                                | Foundation |
| Tasks, exams, sessions            | CRUD exists. Exams include topic checklists and countdown; sessions include subject/topic/date/duration/status | Records are mostly independent; no shared topic IDs, exam plan links, or adaptive missed-session recalculation                                               | P0         |
| Dashboard                         | Greeting, exam countdown, Daily Lesson, daily goal, schedule, habits, actions, study-time chart                | Informative rather than a prioritised command center; no ranked next action, availability estimate, or synthesised daily plan                                | P0         |
| Study planner                     | Rule-based 7-day subject plan using difficulty, confidence, exam date, and recency                             | Does not persist a connected plan, allocate specific exam topics, rebalance missed work, or react to learning evidence                                       | P0         |
| Flashcards                        | Deck/card CRUD, due dates, interval, review count, Easy/Difficult actions                                      | Minimal schedule only; no Again/Hard/Good/Easy scale, last review, retention signal, topic relation, or generated-card review workflow                       | P0         |
| Quizzes and learning evidence     | No quiz, mastery, weak-topic, or assessment modules found                                                      | Entire learn → practice → test → review loop is absent                                                                                                       | P0         |
| Progress                          | XP, streaks, completed sessions/focus minutes, time-based subject view                                         | Time is presented as progress; there is no evidence-based mastery or weak-topic ranking                                                                      | P0/P1      |
| Notes and knowledge hub           | Private notes have subject labels, search, pinning, and timestamps                                             | No topic, exam, deck, quiz, session, or material links                                                                                                       | P1         |
| AI assistant and Daily Lessons    | Server-side answer paths, coarse profile/session context, Daily Lesson learning content                        | No minimal task-specific workspace context, recommendation engine, structured quiz/card generation, or learner approval workflow                             | P1         |
| Study materials / PDFs            | Secure profile image storage exists                                                                            | No student-material model, upload path, explicit AI-operation consent, or document-derived study workflow                                                    | P1         |
| Productivity                      | Week/day/month calendar, reminders, goals, habits, focus timer, budget, search, Quick Add are present          | These remain mostly separate; calendar does not consume a persisted study plan; search misses quizzes/materials; Quick Add lacks exam confirmation semantics | P2         |
| Ecosystem and Ghana-first support | Multi-currency budget and flexible education levels/subjects provide a base                                    | No moderation-ready sharing, school/class model, syllabus/content catalogue, or advanced analytics                                                           | P3         |

## Safe data-model direction

The next migration should add **optional, defaulted workspace collections** rather than replacing stable task, session, exam, deck, or note records. The minimum connected model is: `SubjectTopic` for canonical topic identity; `LearningEvidence` for quiz/flashcard/practice/session signals; `StudyPlan` and plan items for a persistent, reschedulable plan; and references from exam, session, note, deck/card, quiz, and recommendation to `subjectId`/`topicId` where available. Existing human-readable subject and topic fields remain intact during migration so prior workspace data restores without loss.

Mastery must be a transparent evidence score, not a proxy for time. The initial weighting will favour completed and recent quiz responses, then flashcard review outcomes, with modest capped credit for intentional study sessions and practice. The UI will show the evidence contributing to a score and label sparse evidence as an estimate.

## Prioritized delivery plan

| Order    | Increment                                  | Delivered outcome                                                                                                                   | Guardrails                                                                        |
| -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **P0.1** | Connected learning data and planner engine | Migrated topic/evidence/plan model; pure recommendation and adaptive re-planning helpers with tests                                 | Defaults preserve old workspaces; no AI dependency; no data deletion              |
| **P0.2** | Command-center dashboard and Today’s Plan  | Ranked next action, due-work/exam/flashcard signals, available-time estimate, and Start Session path                                | Rule-based and explainable; usable offline; empty-state guidance                  |
| **P0.3** | Exam-linked planning and learning loop     | Exam topics create plan slots; missed sessions rebalance within remaining availability instead of shifting backlog blindly          | Student can edit/decline; never overschedules                                     |
| **P0.4** | Real flashcard and quiz evidence           | Four-grade review schedule; quiz attempt/result/weak-topic records; progress uses evidence                                          | Quiz content is editable; generated content is never auto-trusted                 |
| **P1.1** | Subject knowledge hub and mastery          | Linked notes/topics/exams/decks/quizzes/sessions, transparent subject/topic mastery                                                 | Accessibility-first pages and safe state migrations                               |
| **P1.2** | AI learning intelligence                   | Minimal relevant context for recommendations; reviewable AI card/quiz drafts; daily and weekly review                               | Server-only AI, rate limits, explicit disclosure, no full-workspace prompt        |
| **P1.3** | Study-material workflow                    | Account-owned file metadata and storage; explicit student action for summarise/explain/cards/quiz                                   | Do not process uploaded material automatically; validate file type/size/ownership |
| **P2**   | Unified productivity                       | Calendar consumes plans, focus records topic evidence, smart notifications remain user-controlled, search covers connected entities | No in-process timers; preserve mobile performance and offline paths               |
| **P3**   | Extension boundaries                       | Moderation-first sharing architecture, Ghana-first catalogue hooks, advanced analytics and cross-device enhancements                | No unmoderated public sharing or fake social activity                             |

## First implementation increment

The first P0 increment will establish the optional connected data model and pure planning/recommendation functions, then make the dashboard consume those functions. This creates a useful command center without waiting for AI or PDF processing and gives all later modules a stable, account-synced vocabulary.

## Acceptance evidence required for each increment

Each increment requires canonical-schema migration coverage, account-isolation and offline-queue regression checks, feature-specific unit tests, TypeScript, a production build, and mobile visual review. AI work additionally requires server-only invocation, bounded minimal context, structured-output validation, failure states, and explicit learner review before generated study content is saved.
