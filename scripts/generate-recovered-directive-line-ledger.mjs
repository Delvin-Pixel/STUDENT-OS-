import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const inputs = [
  {
    file: "/home/ubuntu/upload/pasted_content.txt",
    short: "directive-file-1",
    ranges: [
      [
        1,
        68,
        "Recovery instructions and operating constraints",
        "PASS — reconciliation policy recorded",
      ],
      [
        69,
        117,
        "Part 1 — Authentication landing screen",
        "PARTIAL — source controls verified; provider/device flow remains manual",
      ],
      [
        118,
        280,
        "Part 2 — OpenAI / AI architecture",
        "PARTIAL — protected bounded architecture exists; live quality and adversarial evaluation remain external",
      ],
      [
        281,
        490,
        "Part 3 — Unified quiz system",
        "PARTIAL — unified practice and trusted assessment exist; exact 50-question and data-driven AI feedback gaps remain",
      ],
      [
        491,
        576,
        "Part 4 — Education/curriculum subjects",
        "PARTIAL — narrow cited Ghana provenance seed; full multi-system catalogue absent",
      ],
      [
        577,
        631,
        "Part 5 — Cross-system audit",
        "PASS — source audit and repair evidence published",
      ],
      [
        632,
        637,
        "Part 6 — Database/security (continued in file 2)",
        "PASS — controlled owner-scope and constraint evidence",
      ],
    ],
  },
  {
    file: "/home/ubuntu/upload/pasted_content_2.txt",
    short: "directive-file-2",
    ranges: [
      [
        1,
        19,
        "Part 6 — Database/security",
        "PASS — controlled owner-scope and constraint evidence",
      ],
      [
        20,
        48,
        "Part 7 — Mobile-first",
        "NOT VERIFIED — requires authenticated physical browser/device matrix",
      ],
      [
        49,
        109,
        "Part 8 — Actual flows",
        "PARTIAL — controlled contracts pass; provider/device flows remain manual",
      ],
      [
        110,
        135,
        "Part 9 — Quality gates",
        "PARTIAL — full tests/type/build pass; lint unavailable and external gates remain manual",
      ],
      [
        136,
        151,
        "Part 10 — No fake success",
        "PASS — evidence policy and manual boundaries preserved",
      ],
      [
        152,
        170,
        "Part 11 — Architectural goal",
        "PARTIAL — connected architecture exists; full catalogue and live AI outcomes remain incomplete",
      ],
      [
        171,
        178,
        "Part 12 — Product experience",
        "PARTIAL — source capability exists; learner usability needs manual acceptance",
      ],
      [
        179,
        319,
        "Execution rule and deliverable",
        "PASS — incremental repair/test/archive process documented",
      ],
    ],
  },
];

function findRange(ranges, line) {
  return ranges.find(([start, end]) => line >= start && line <= end);
}

function cell(value) {
  return value.replaceAll("|", "\\|").trim() || "—";
}

const rows = [];
let total = 0;
for (const input of inputs) {
  const lines = readFileSync(input.file, "utf8").split(/\r?\n/);
  total += lines.length;
  lines.forEach((text, zeroIndex) => {
    const line = zeroIndex + 1;
    const range = findRange(input.ranges, line);
    const domain = range?.[2] ?? "Unclassified source text";
    const status = range?.[3] ?? "BLOCKED — unmapped source range";
    rows.push(
      `| ${input.short} | ${line} | ${cell(text)} | ${cell(domain)} | ${cell(status)} |`
    );
  });
}

const output = `# Recovered Deep Directive Source-Line Ledger\n\nThis generated ledger accounts for all **${total} supplied source lines** across the two recovered directive files. It uses the detailed requirement statuses in \`docs/recovered-deep-directive-reconciliation.md\`; line-level status inherits its applicable directive part and does not overclaim device or provider behavior. Rebuild with \`node scripts/generate-recovered-directive-line-ledger.mjs\`.\n\n| Source file | Source line | Source text | Directive part | Reconciliation status |\n|---|---:|---|---|---|\n${rows.join("\n")}\n`;
writeFileSync(
  resolve(root, "docs/recovered-deep-directive-line-ledger.md"),
  output
);
console.log(`Wrote ${total} directive source-line records.`);
