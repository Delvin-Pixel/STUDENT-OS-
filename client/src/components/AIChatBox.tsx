import { SafeAnswerMarkdown } from "@/components/SafeAnswerMarkdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AI_ANSWER_FEEDBACK_REASON_OPTIONS } from "@/lib/answerRatings";
import { chatMessageMinHeight } from "@/lib/chatLayout";
import type { AiAnswerFeedbackReason } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** An AI-generated media attachment surfaced beneath an assistant message. */
export type MediaAttachment = {
  url: string;
  caption: string;
};

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  media?: MediaAttachment;
  rating?: "up" | "down";
  reason?: AiAnswerFeedbackReason;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];

  /**
   * Optional renderer for AI-generated media attachments on assistant messages.
   * When omitted, attachments are rendered as a default captioned image.
   */
  renderMedia?: (attachment: MediaAttachment) => React.ReactNode;
  /** Optional private learner-feedback handler for AI answers. */
  onRateAnswer?: (
    message: Message,
    rating: "up" | "down",
    reason?: AiAnswerFeedbackReason
  ) => void;
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Safe lightweight Markdown basics without code, diagram, or HTML execution
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
function defaultMediaRenderer(attachment: MediaAttachment) {
  return (
    <figure className="my-2 overflow-hidden rounded-lg border border-border bg-background">
      <img
        src={attachment.url}
        alt={attachment.caption}
        className="max-h-72 w-full object-contain"
        loading="lazy"
      />
      <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
        {attachment.caption}
      </figcaption>
    </figure>
  );
}

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  renderMedia = defaultMediaRenderer,
  onRateAnswer,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter(msg => msg.role !== "system");

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    const recalculate = () => {
      if (!containerRef.current || !inputAreaRef.current) return;
      setMinHeightForLastMessage(
        chatMessageMinHeight(
          containerRef.current.offsetHeight,
          inputAreaRef.current.offsetHeight
        )
      );
    };
    recalculate();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", recalculate);
      return () => window.removeEventListener("resize", recalculate);
    }
    const observer = new ResizeObserver(recalculate);
    if (containerRef.current) observer.observe(containerRef.current);
    if (inputAreaRef.current) observer.observe(inputAreaRef.current);
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <SafeAnswerMarkdown content={message.content} />
                          {message.media ? renderMedia(message.media) : null}
                          {onRateAnswer && message.id ? (
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
                                className={cn(
                                  "h-7 w-7 rounded-full",
                                  message.rating === "up" &&
                                    "bg-primary/10 text-primary"
                                )}
                                aria-label="This answer was helpful"
                                aria-pressed={message.rating === "up"}
                                onClick={() => onRateAnswer(message, "up")}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-7 w-7 rounded-full",
                                  message.rating === "down" &&
                                    "bg-destructive/10 text-destructive"
                                )}
                                aria-label="This answer was not helpful"
                                aria-pressed={message.rating === "down"}
                                onClick={() => onRateAnswer(message, "down")}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                          {onRateAnswer &&
                          message.id &&
                          message.rating === "down" ? (
                            <div
                              className="mt-2 rounded-lg bg-background/70 px-2.5 py-2"
                              role="group"
                              aria-label="Optional reason this answer was not helpful"
                            >
                              <p className="text-[11px] font-medium text-muted-foreground">
                                What would have helped?{" "}
                                <span className="font-normal">Optional</span>
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {AI_ANSWER_FEEDBACK_REASON_OPTIONS.map(
                                  option => (
                                    <Button
                                      key={option.value}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "h-7 rounded-full px-2 text-[10px]",
                                        message.reason === option.value &&
                                          "border-primary bg-primary/10 text-primary"
                                      )}
                                      aria-pressed={
                                        message.reason === option.value
                                      }
                                      onClick={() =>
                                        onRateAnswer(
                                          message,
                                          "down",
                                          option.value
                                        )
                                      }
                                    >
                                      {option.label}
                                    </Button>
                                  )
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t bg-background/50 items-end"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 max-h-32 resize-none min-h-9"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
