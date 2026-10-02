# STUDENT OS — Design Brainstorm

Tagline: "Your entire student life. In one place."
Target: secondary-school & university students. Mobile-first PWA, offline-first local storage.

## Three Stylistic Approaches

### 1. Paper & Ink (Academic Editorial)

Warm paper-cream backgrounds, serif display type, notebook-inspired details (ruled lines, margin doodles). Feels like a beautifully organized study journal. Probability: 0.06

### 2. Midnight Terminal (Dark OS)

Dark slate base with neon-teal accents, monospace numerals, HUD-style data cards — a "command center" for students. Probability: 0.03

### 3. Daybreak Workspace (Soft Productivity Pop)

Light, airy interface with a warm sunrise gradient palette (coral → amber → soft violet), chunky rounded cards, playful micro-motion — feels like a friendly daily planner app with real personality. Probability: 0.04

---

## CHOSEN: Daybreak Workspace (Soft Productivity Pop)

**Design Movement**: Contemporary "friendly SaaS" meets editorial planner design — think Notion-calibre warmth with Duolingo-scale approachability, grounded in Swiss grid discipline softened by rounded geometry.

**Core Principles**:

1. **Warm light-first**: The default is a bright, calm interface (light as paper, not sterile white) — energy without stress.
2. **Density with breathing room**: Data-rich dashboard, but every card gets generous internal padding and consistent 16px gutter rhythm.
3. **Functional color coding**: Each subject and system gets a signature hue used consistently (charts, progress bars, badges) so information is scannable at a glance.
4. **Motion as confirmation**: Small, fast, physically intuitive animations confirm actions — never decorative delay.

**Color Philosophy**: A warm "daybreak" primary — a vibrant coral-orange (oklch ~0.65 0.19 35) that feels energetic and human, not corporate blue. Backed by a soft cream canvas (oklch 0.985 0.008 85) and a deep ink for text (near-black warm grey). Subject colors: coral, teal, violet, amber, sky, emerald. The dark theme is a deep warm aubergine-slate, not pure black — preserves the warmth at night.

**Layout Paradigm**: Mobile-first: single column, bottom tab bar, dashboard stacked as glanceable widgets. Desktop: persistent left sidebar with icon+label nav, main content in a max-w layout with a subtle right rail for streaks/XP on the dashboard. Avoid centered hero-style layouts — content is left-aligned with asymmetric widget sizes (large progress chart + small stat tiles).

**Signature Elements**:

1. The "streak flame" badge + XP ring widget — a persistent gamification header element.
2. Soft shadow cards with 1.5rem radius and a coral left-accent bar for the active/priority item.
3. Rounded pill buttons and tag chips everywhere (pills as the atomic shape language).

**Interaction Philosophy**: Instant feedback — tap a task, it checks with a satisfying scale-down; start the timer, UI immediately transforms. In-app notification toasts for every state change. Long-press-free; everything reachable with one thumb on mobile.

**Animation**: Entrances: 200ms ease-out fade+translateY(8px), staggered 40ms per card. Buttons: scale(0.97) on active 140ms. Timer ring animates continuously; flashcard flip uses 3D rotateY 250ms. Streak badge pulses gently on milestone. Respect prefers-reduced-motion.

**Typography System**: Display/headings: "Outfit" (geometric, friendly, slightly quirky — perfect for a student OS). Body/UI: "Inter"-alternative "Public Sans" at 400/500/600. Numerals for timer/stats in Outfit SemiBold tabular. Hierarchy: Dashboard greeting 28-32px Outfit 700; card titles 16-18px 600; body 14-15px; captions 12px muted.

**Brand Essence**: A personal operating system for student life — for students who want their studies, tasks, and goals in one calm place. Personality: encouraging, organized, quietly playful.

**Brand Voice**: Warm coach, never robotic. Headlines address the student by name; CTAs are verbs. Examples: "Good afternoon, Delvin 👋 — let's make today productive." / "One session away from your streak. You've got this."

**Wordmark & Logo**: Wordmark "STUDENT OS" in Outfit Bold, tight tracking, with the "OS" in coral and the "S" of OS replaced by a custom bolt/gradient mark. Logo mark: a rounded-square badge containing an open book morphing into a play button, gradient coral→violet.

**Signature Brand Color**: Daybreak Coral — oklch(0.65 0.19 35) — an ownable warm orange-coral that stands apart from the sea of blue productivity apps.

## Architecture Notes

- Local-first: all data in localStorage (structured stores) with an export/import JSON layer; easy to migrate to IndexedDB later.
- No external APIs; rule-based Study Assistant + local Smart Planner algorithm.
- PWA: manifest + service worker for installability and offline shell.
- Routes: / (dashboard), /study, /tasks, /focus, /flashcards, /timetable, /exams, /progress, /goals, /budget, /assistant, /settings + /onboarding flow.
- Nav: bottom bar (Home, Study, Tasks, Focus, More) on mobile < lg; sidebar on desktop; "More" sheet covers Flashcards, Timetable, Exams, Progress, Goals, Budget, Assistant, Settings.
