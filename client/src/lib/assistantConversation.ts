export type AssistantConversationEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
};

/** Replaces a reply placeholder in place, preserving question-and-answer order despite network arrival order. */
export function resolveAssistantReply<T extends AssistantConversationEntry>(
  messages: T[],
  replyId: string,
  reply: T
): T[] {
  return messages.map(message => (message.id === replyId ? reply : message));
}
