# B44 — Intelligent Assessment Generation

Assessment generation now consumes bounded diagnostic context from the deterministic assessment-intelligence layer.

Flow:
Assessment response history → concept signal → focused assessment guidance → fresh question generation → freshness validation → review → new evidence → B43 verification.

Controls:

- focus is limited to six concepts
- recent miss concepts are limited to eight
- prior prompts excluded from generation are limited to twenty
- generated questions must still pass the existing 50-question structured schema and educational/semantic validation
- exact reuse of an excluded prompt is rejected
- focused generation must allocate a meaningful number of tagged questions to the requested weak concepts
- no full workspace is sent to the AI model
- generated quizzes remain reviewable drafts and are not saved automatically

This layer does not diagnose intent or claim a misconception. It uses deterministic concept signals to improve assessment targeting.
