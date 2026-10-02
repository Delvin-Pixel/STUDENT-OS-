import ts from "typescript";
import { expect } from "vitest";

// Compare source contracts without depending on Prettier's whitespace,
// optional trailing commas, or parentheses around single arrow parameters.
// All other tokens, including complete string literal contents, stay intact.
function tokens(source: string): string[] {
  const result: string[] = [];
  const file = ts.createSourceFile(
    "contract.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const visit = (node: ts.Node) => {
    const children = node.getChildren(file);
    if (children.length) children.forEach(visit);
    else if (node.kind !== ts.SyntaxKind.EndOfFileToken) {
      const text = node.getText(file);
      if (text.trim()) result.push(text);
    }
  };
  visit(file);
  return result.filter((token, index) => {
    if (token === "," && [")", "]", "}"].includes(result[index + 1]))
      return false;
    if (
      token === "(" &&
      /^[A-Za-z_$][\w$]*$/.test(result[index + 1] ?? "") &&
      result[index + 2] === ")" &&
      result[index + 3] === "=>"
    )
      return false;
    if (
      token === ")" &&
      result[index - 2] === "(" &&
      /^[A-Za-z_$][\w$]*$/.test(result[index - 1] ?? "") &&
      result[index + 1] === "=>"
    )
      return false;
    return true;
  });
}

export function containsSource(source: string, fragment: string): boolean {
  if (source.includes(fragment)) return true;
  const actual = tokens(source);
  const expected = tokens(fragment);
  if (!expected.length) return false;
  return actual.some((_, start) =>
    expected.every((token, offset) => actual[start + offset] === token)
  );
}

expect.extend({
  toContainSource(received: string, expected: string) {
    return {
      pass: containsSource(received, expected),
      message: () =>
        `Expected source ${this.isNot ? "not " : ""}to contain the exact code tokens of:\n${expected}`,
    };
  },
});

declare module "vitest" {
  interface Assertion<T = any> {
    toContainSource(expected: string): T;
  }
}
