import { describe, expect, it } from "vitest";
import {
  resolveAssistantReply,
  type AssistantConversationEntry,
} from "./assistantConversation";

describe("Study Assistant conversation ordering", () => {
  it("keeps replies beside their originating questions when a later request resolves first", () => {
    const initial: AssistantConversationEntry[] = [
      { id: "welcome", role: "assistant", text: "Welcome" },
      { id: "question-a", role: "user", text: "First question" },
      { id: "reply-a", role: "assistant", text: "Thinking…", pending: true },
      { id: "question-b", role: "user", text: "Second question" },
      { id: "reply-b", role: "assistant", text: "Thinking…", pending: true },
    ];

    const secondFirst = resolveAssistantReply(initial, "reply-b", {
      id: "reply-b",
      role: "assistant",
      text: "Second answer",
    });
    const settled = resolveAssistantReply(secondFirst, "reply-a", {
      id: "reply-a",
      role: "assistant",
      text: "First answer",
    });

    expect(settled.map(message => message.text)).toEqual([
      "Welcome",
      "First question",
      "First answer",
      "Second question",
      "Second answer",
    ]);
  });
});
