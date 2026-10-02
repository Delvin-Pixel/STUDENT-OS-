export type MaterialPracticeQuestionDraft = {
  title: string;
  instructions: string;
  questions: Array<{
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  }>;
};

export type PdfExportLine = {
  kind: "title" | "heading" | "body" | "meta" | "spacer";
  value: string;
};

export function isMaterialPracticeDraftReviewed(
  questionCount: number,
  confirmations: Record<number, boolean>
) {
  return (
    questionCount > 0 &&
    Array.from({ length: questionCount }, (_, index) =>
      Boolean(confirmations[index])
    ).every(Boolean)
  );
}

function printable(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildReviewedPracticeQuestionPdfLines(
  draft: MaterialPracticeQuestionDraft,
  downloadedAt: Date
) {
  return [
    { kind: "title", value: printable(draft.title) },
    {
      kind: "meta",
      value: "Student OS | Reviewed AI-generated practice questions",
    },
    {
      kind: "meta",
      value: `Downloaded ${downloadedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
    },
    { kind: "spacer", value: "" },
    { kind: "heading", value: "Instructions" },
    { kind: "body", value: printable(draft.instructions) },
    ...draft.questions.flatMap((question, questionIndex) => {
      const correctOption = question.options[question.correctOptionIndex] ?? "";
      return [
        { kind: "spacer" as const, value: "" },
        {
          kind: "heading" as const,
          value: `${questionIndex + 1}. ${printable(question.prompt)}`,
        },
        ...question.options.map((option, optionIndex) => ({
          kind: "body" as const,
          value: `${String.fromCharCode(65 + optionIndex)}. ${printable(option)}`,
        })),
        {
          kind: "body" as const,
          value: `Answer: ${String.fromCharCode(65 + question.correctOptionIndex)}. ${printable(correctOption)}`,
        },
        {
          kind: "body" as const,
          value: `Explanation: ${printable(question.explanation)}`,
        },
      ];
    }),
  ] satisfies PdfExportLine[];
}

function wrapPdfText(value: string, maxCharacters = 82) {
  const words = printable(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function downloadFilename(title: string) {
  const stem =
    printable(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "practice-questions";
  return `${stem}-student-os.pdf`;
}

/** Creates the file only in the learner's browser after every drafted answer was reviewed. */
export async function downloadReviewedPracticeQuestionsPdf(
  draft: MaterialPracticeQuestionDraft,
  confirmations: Record<number, boolean>,
  downloadedAt = new Date()
) {
  if (!isMaterialPracticeDraftReviewed(draft.questions.length, confirmations)) {
    throw new Error(
      "Review every proposed question, answer, and explanation before exporting it."
    );
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  pdf.setProperties({
    title: printable(draft.title),
    subject: "Reviewed practice questions",
    author: "Student OS",
    creator: "Student OS",
  });

  const pageWidth = 595.28;
  const left = 48;
  const right = pageWidth - 48;
  const top = 56;
  const bottom = 780;
  const lineHeight = 15;
  let y = top;

  for (const line of buildReviewedPracticeQuestionPdfLines(
    draft,
    downloadedAt
  )) {
    if (line.kind === "spacer") {
      y += 8;
      continue;
    }
    const isTitle = line.kind === "title";
    const isHeading = line.kind === "heading";
    const fontSize = isTitle
      ? 18
      : isHeading
        ? 12
        : line.kind === "meta"
          ? 9
          : 10;
    const lines = wrapPdfText(line.value, isTitle ? 48 : 82);
    if (y + lines.length * lineHeight > bottom) {
      pdf.addPage();
      y = top;
    }
    pdf.setFont("helvetica", isTitle || isHeading ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(
      line.kind === "meta" ? 95 : 25,
      line.kind === "meta" ? 95 : 25,
      line.kind === "meta" ? 95 : 25
    );
    pdf.text(lines, left, y, {
      maxWidth: right - left,
      lineHeightFactor: 1.25,
    });
    y += lines.length * lineHeight + (isTitle ? 5 : isHeading ? 2 : 0);
  }

  pdf.save(downloadFilename(draft.title));
}
