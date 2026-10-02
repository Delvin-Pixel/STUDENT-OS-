import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = "/home/ubuntu/upload/pasted_content.txt";
const outputPath = resolve(root, "docs/product-spec-line-ledger.md");

const sections = [
  [
    1,
    20,
    54,
    "Core daily questions",
    "Command center, connected workspace, and deterministic learning intelligence",
  ],
  [2, 55, 69, "Command center", "Dashboard and ranked next actions"],
  [3, 70, 99, "Today plan", "Daily context and timetable/task/exam capacity"],
  [
    4,
    100,
    138,
    "Study planner",
    "Canonical revision plans and capacity-safe recovery",
  ],
  [
    5,
    139,
    152,
    "Connected exams",
    "Exam-topic links across learning artifacts",
  ],
  [6, 153, 168, "Learning loop", "Practice, evidence, review, retest, mastery"],
  [
    7,
    169,
    190,
    "Spaced repetition",
    "Canonical four-grade flashcard scheduling",
  ],
  [
    8,
    191,
    211,
    "Generated flashcards",
    "Consent, bounded drafts, learner review",
  ],
  [9, 212, 232, "AI quizzes", "Reviewed quiz drafts and canonical practice"],
  [
    10,
    233,
    252,
    "Quiz actionability",
    "Evidence-driven priority and remediation",
  ],
  [11, 253, 270, "Mastery", "Evidence-weighted topic projections"],
  [12, 271, 283, "Knowledge hub", "Connected subject/topic resources"],
  [13, 284, 301, "Connected notes", "Canonical note/topic/exam links"],
  [14, 302, 319, "Materials", "Account-owned consent-gated material workflows"],
  [15, 320, 340, "AI context/privacy", "Protected minimal-context assistant"],
  [16, 341, 356, "Quick Add", "Previewed natural-language drafts"],
  [17, 357, 379, "Focus", "Objective-linked canonical effort evidence"],
  [18, 380, 394, "Gamification", "One-time reward and evidence safeguards"],
  [19, 395, 401, "Streak tone", "Supportive streak and goal UX"],
  [20, 402, 410, "Notifications", "Categories, quiet hours, caps, ownership"],
  [21, 411, 432, "Search", "Connected canonical global search"],
  [
    22,
    433,
    442,
    "Dashboard customization",
    "Sensible defaults; unlimited layout intentionally deferred",
  ],
  [
    23,
    443,
    459,
    "Daily briefing",
    "Canonical priorities and available capacity",
  ],
  [
    24,
    460,
    482,
    "End-of-day review",
    "Canonical daily review and plan preparation",
  ],
  [
    25,
    483,
    497,
    "Weekly review",
    "Canonical weekly evidence and recommendations",
  ],
  [
    26,
    498,
    520,
    "Recommendation ranking",
    "Single deterministic next-action engine",
  ],
  [27, 521, 535, "Calendar", "Connected calendar/timetable/plan model"],
  [28, 536, 545, "Budget", "Simple canonical budget with local currency"],
  [
    29,
    546,
    559,
    "Cloud/local-first",
    "Authenticated workspace hydration, sync, conflict merge",
  ],
  [
    30,
    560,
    574,
    "Sharing",
    "Deferred pending moderation and privacy architecture",
  ],
  [
    31,
    575,
    591,
    "Ghana context",
    "Optional cited NaCCA secondary provenance seed",
  ],
  [
    32,
    592,
    618,
    "Connected simplicity",
    "One workspace and learning-intelligence system",
  ],
  [
    33,
    619,
    642,
    "One student system",
    "Canonical state with AI as bounded layer",
  ],
  [34, 643, 657, "Performance", "Lazy chunk and bundle-boundary controls"],
  [
    35,
    658,
    671,
    "Mobile-first",
    "Responsive source contracts; physical-device acceptance manual",
  ],
  [
    36,
    672,
    681,
    "Accessibility",
    "Targeted semantics and reduced motion; AT acceptance manual",
  ],
  [37, 682, 690, "Empty states", "Audited helpful feature empty states"],
  [
    38,
    691,
    700,
    "Error states",
    "Bounded errors/recovery without raw upstream disclosure",
  ],
  [39, 701, 706, "Differentiator", "Connected next-action philosophy"],
  [
    40,
    707,
    755,
    "Target experience",
    "Implemented as connected capability trajectory, not outcome guarantee",
  ],
  [
    41,
    756,
    792,
    "Implementation priorities",
    "Incremental P0–P3 delivery with safe deferrals",
  ],
  [
    42,
    793,
    801,
    "Do not break",
    "Focused tests, validation, checkpoints, archives",
  ],
  [
    43,
    802,
    821,
    "Success measures",
    "Source-controlled guarantees plus manual device boundaries",
  ],
  [
    44,
    822,
    830,
    "Final principle",
    "Coherence, usefulness, reliability, intelligence, simplicity",
  ],
  [
    "Final",
    831,
    833,
    "Final instruction",
    "Current-source inspection and incremental evidence-led work",
  ],
];

const lines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
const index = new Map();
for (const [number, start, end, area, disposition] of sections) {
  for (let line = start; line <= end; line += 1)
    index.set(line, { number, area, disposition });
}

const escapeCell = value =>
  value.replaceAll("|", "\\|").replaceAll("\n", " ").trim() || "—";
const rows = lines.map((text, indexZero) => {
  const line = indexZero + 1;
  const mapped = index.get(line);
  const section = mapped
    ? `${mapped.number} — ${mapped.area}`
    : "Preamble / product context";
  const disposition = mapped
    ? mapped.disposition
    : "Product context captured by the section matrix";
  return `| ${line} | ${escapeCell(text)} | ${escapeCell(section)} | ${escapeCell(disposition)} |`;
});

const output = `# Product Specification Line Ledger\n\nThis generated ledger accounts for all ${lines.length} lines in \`${sourcePath}\`. Its interpretation links to the evidence and manual-boundary matrix in \`docs/final-evidence-led-hardening-status.md\`; it does **not** claim an illustrative example is a separate mandatory engine. Rebuild with \`node scripts/generate-product-spec-line-ledger.mjs\`.\n\n| Source line | Source text | Reconciled section | Evidence disposition |\n|---:|---|---|---|\n${rows.join("\n")}\n`;
writeFileSync(outputPath, output);
console.log(`Wrote ${lines.length} source-line records to ${outputPath}`);
