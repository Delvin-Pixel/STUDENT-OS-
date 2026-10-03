/* STUDENT OS — AI Study Assistant. The server owns answer generation; the client
   supplies only narrowly selected context for questions that explicitly need it. */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/StoreContext";
import { AI_ANSWER_FEEDBACK_REASON_OPTIONS } from "@/lib/answerRatings";
import { getAssistantReply } from "@/lib/assistant";
import { resolveAssistantReply } from "@/lib/assistantConversation";
import { getCurrentWeekLearningMinutes } from "@/lib/assistantPersonalization";
import { trpc } from "@/lib/trpc";
import type { AiAnswerFeedbackReason } from "@/lib/types";
import { minutesToLabel } from "@/lib/utils";
import { Bot, Send, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { useMemo, useRef, useState } from "react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: "nexa" | "openai" | "studentos";
  media?: { url: string; caption: string };
  rating?: "up" | "down";
  reason?: AiAnswerFeedbackReason;
  pending?: boolean;
}

const SUGGESTIONS = [
  "How do I study effectively?",
  "How can I remember more?",
  "Help me plan my study week",
  "I keep procrastinating",
  "How do I stay motivated?",
  "Tips for exam preparation",
  "Create a diagram of the states of matter",
];

export default function Assistant() {
  const { state, rateAiAnswer } = useStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Hi! I'm your Study Assistant. Ask me about study techniques, planning, motivation, memory, or productivity — or pick a suggestion below. I connect to our AI tutor to give you a fresh answer for every question.`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const assistantQuery = trpc.studyAssistant.ask.useMutation();

  const profileSummary = useMemo(() => {
    const p = state.profile;
    if (!p) return "";
    const weekMinutes = getCurrentWeekLearningMinutes(state);
    return `Education: ${p.studentType}. Subjects: ${p.subjects.join(", ") || "none set"}. Sessions completed: ${state.sessions.filter(s => s.status === "completed").length}. Focus sessions: ${state.focusSessions.length}. Learning time this week: ${minutesToLabel(weekMinutes)}. Streak: ${state.streakDays} days.`;
  }, [state]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || assistantQuery.isPending) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: q };
    const replyId = crypto.randomUUID();

    setMessages(m => [
      ...m,
      userMsg,
      { id: replyId, role: "assistant", text: "Thinking…", pending: true },
    ]);
    setInput("");
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
      50
    );
    try {
      const needsLearnerContext =
        /\b(?:my|plan|schedule|deadline|due|exam|assignment|task|progress|streak|this week|tomorrow)\b/i.test(
          q
        );
      const response = await assistantQuery.mutateAsync({
        question: q,
        ...(needsLearnerContext ? { studyContext: profileSummary } : {}),
      });
      const { media } = response;
      setMessages(m =>
        resolveAssistantReply(m, replyId, {
          id: replyId,
          role: "assistant",
          text: response.answer,
          source: response.source,
          ...(media ? { media } : {}),
        })
      );
    } catch {
      const { text: answer } = getAssistantReply(q);
      setMessages(m =>
        resolveAssistantReply(m, replyId, {
          id: replyId,
          role: "assistant",
          text: answer,
          source: "studentos",
        })
      );
    }
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
      50
    );
  };

  const rateAnswer = (
    id: string,
    rating: "up" | "down",
    answerPreview: string,
    reason?: AiAnswerFeedbackReason
  ) => {
    rateAiAnswer(id, "assistant", rating, answerPreview, reason);
    setMessages(current =>
      current.map(message =>
        message.id === id
          ? {
              ...message,
              rating,
              ...(rating === "down" && reason
                ? { reason }
                : { reason: undefined }),
            }
          : message
      )
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-2xl flex-col lg:h-[calc(100dvh-9rem)]">
      <div className="flex items-center gap-2.5 border-b border-border pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="leading-tight">
          <h1 className="font-display text-lg font-bold">Study Assistant</h1>
          <p className="text-[11px] text-muted-foreground">
            Powered by the Student OS AI tutor
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-4">
        <div className="flex flex-col gap-3">
          {messages.map(m => (
            <div
              key={m.id}
              className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  m.role === "user"
                    ? "bg-muted-foreground/15 text-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {m.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground shadow-sm"
                }`}
              >
                {m.text}
                {m.role === "assistant" && m.media ? (
                  <figure className="my-2 overflow-hidden rounded-2xl border border-border">
                    <img
                      src={m.media.url}
                      alt={m.media.caption}
                      className="max-h-72 w-full object-contain"
                      loading="lazy"
                    />
                    <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
                      {m.media.caption}
                    </figcaption>
                  </figure>
                ) : null}
                {m.role === "assistant" && m.source && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Answer source:{" "}
                    {m.source === "nexa"
                      ? "NEXA tutor"
                      : m.source === "openai"
                        ? "Student OS tutor"
                        : "Student OS local guide"}
                  </p>
                )}
                {m.role === "assistant" && m.id !== "welcome" && !m.pending && (
                  <div
                    className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2"
                    aria-label="Rate this answer"
                  >
                    <span className="mr-1 text-[11px] text-muted-foreground">
                      Useful?
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 rounded-full ${m.rating === "up" ? "bg-primary/10 text-primary" : ""}`}
                      aria-label="This answer was helpful"
                      aria-pressed={m.rating === "up"}
                      onClick={() => rateAnswer(m.id, "up", m.text)}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 rounded-full ${m.rating === "down" ? "bg-destructive/10 text-destructive" : ""}`}
                      aria-label="This answer was not helpful"
                      aria-pressed={m.rating === "down"}
                      onClick={() => rateAnswer(m.id, "down", m.text)}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {m.role === "assistant" &&
                  m.id !== "welcome" &&
                  m.rating === "down" && (
                    <div
                      className="mt-2 rounded-lg bg-muted/70 px-2.5 py-2"
                      role="group"
                      aria-label="Optional reason this answer was not helpful"
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">
                        What would have helped?{" "}
                        <span className="font-normal">Optional</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {AI_ANSWER_FEEDBACK_REASON_OPTIONS.map(option => (
                          <Button
                            key={option.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`h-7 rounded-full px-2 text-[10px] ${m.reason === option.value ? "border-primary bg-primary/10 text-primary" : ""}`}
                            aria-pressed={m.reason === option.value}
                            onClick={() =>
                              rateAnswer(m.id, "down", m.text, option.value)
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {messages.length === 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border pt-3"
      >
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about studying…"
          className="h-11 rounded-full bg-card"
        />
        <Button
          type="submit"
          disabled={assistantQuery.isPending}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
