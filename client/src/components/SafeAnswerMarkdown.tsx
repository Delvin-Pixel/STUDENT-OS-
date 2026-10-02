/**
 * Renders the small Markdown subset Student OS lesson answers use without
 * interpreting HTML, loading syntax highlighters, or loading diagram engines.
 */
export function SafeAnswerMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter(Boolean);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter(Boolean);
        const heading =
          lines.length === 1 ? lines[0].match(/^(#{1,3})\s+(.+)$/) : null;
        const unordered = lines.every(line => /^[-*]\s+/.test(line.trim()));
        const ordered = lines.every(line => /^\d+[.)]\s+/.test(line.trim()));
        if (heading)
          return (
            <p key={blockIndex} className="mb-2 font-semibold">
              {renderInlineText(heading[2])}
            </p>
          );
        if (unordered)
          return (
            <ul key={blockIndex} className="my-2 list-disc space-y-1 pl-5">
              {lines.map((line, index) => (
                <li key={index}>
                  {renderInlineText(line.replace(/^[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        if (ordered)
          return (
            <ol key={blockIndex} className="my-2 list-decimal space-y-1 pl-5">
              {lines.map((line, index) => (
                <li key={index}>
                  {renderInlineText(line.replace(/^\d+[.)]\s+/, ""))}
                </li>
              ))}
            </ol>
          );
        return (
          <p key={blockIndex} className="mb-2 last:mb-0 whitespace-pre-wrap">
            {renderInlineText(block)}
          </p>
        );
      })}
    </>
  );
}

function renderInlineText(value: string) {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code
          key={index}
          className="rounded bg-background/70 px-1 py-0.5 text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}
