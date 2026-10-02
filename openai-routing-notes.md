# Student OS — AI Routing Notes (internal)

## Key discovery: the working LLM proxy

- `invokeLLM` from `server/_core/llm.ts` uses `ENV.forgeApiUrl` + `ENV.forgeApiKey` (built-in Forge API, env vars BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY).
- Hits `${forgeApiUrl}/v1/chat/completions` — OpenAI-compatible. Works even when direct `api.openai.com` DNS is flaky from sandbox.
- Direct `fetch("https://api.openai.com/v1/chat/completions")` in old code is why live site showed "Student OS tutor (OpenAI response unavailable)".
- Image generation: `generateImage` in `server/_core/imageGeneration.ts` uses `images.v1.ImageService/GenerateImage` on forgeApiUrl; returns base64 → storagePut → URL. Works.

## Implementation (v1.6, DONE so far)

1. `server/studyAssistant.ts`: answer via invokeLLM (structured json_schema tutor_answer: answerMarkdown, checkYourThinking, wantsMedia). Media requests → describeMediaRequest (json_schema → prompt) → generateImage. Optional `media {url, caption}` in response. Fallback = local subject-aware guide (labelled studentos).
2. `server/lessons.ts`: `answerWithOpenAI` uses invokeLLM; `visualiseMediaRequest` builds visual prompt + generateImage; `answerDailyLessonQuestion` attaches `media`. Lesson schema gained optional `illustration {requested, url, caption}`.
3. Client: AIChatBox.tsx has MediaAttachment + message.media + renderMedia (default). DailyLesson.tsx renders result.media + lesson.illustration in sidebar. Assistant.tsx renders media in bubbles + "Create a diagram of the states of matter" suggestion.
4. Tests: 14 files / 37 passing, TS clean. studyAssistant/lessons tests spy invokeLLM/generateImage.

## Remaining: multi-user accounts (user request, in progress)

User wants: shared link → each person signs in with Google/Microsoft/Facebook/Apple and gets a fresh personal account (never sees another user's data/profile).

- Template uses Manus OAuth (useAuth, startLogin). Auth already per-person, but app data is device-localStorage (`studentos:data:v2`), so same-device sharing shows whoever used the device last; different devices never see each other's data.
- Plan: server-side per-user workspace via tRPC save/load (users table exists, Drizzle). New users get empty record → fresh onboarding. Local cache kept for offline feel; server pull on open. Settings: show identity + sign out.
- Checkpoints: fd12a55a was v1.5. Published domain studentos-jmnrfmj9.manus.space. Dev port 3000.
