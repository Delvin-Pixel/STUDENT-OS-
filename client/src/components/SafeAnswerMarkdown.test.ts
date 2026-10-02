import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeAnswerMarkdown } from "./SafeAnswerMarkdown";

describe("SafeAnswerMarkdown", () => {
  it("renders the supported answer structure while leaving injected HTML as text", () => {
    const html = renderToStaticMarkup(
      createElement(SafeAnswerMarkdown, {
        content:
          "## Key idea\n\n- **Mass** is constant\n- Use `m = ρV`\n\n<script>alert('no')</script>",
      })
    );
    expect(html).toContain("<ul");
    expect(html).toContain("<strong>Mass</strong>");
    expect(html).toContain("<code");
    expect(html).toContain(
      "&lt;script&gt;alert(&#x27;no&#x27;)&lt;/script&gt;"
    );
    expect(html).not.toContain("<script>");
  });
});
