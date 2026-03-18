import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  context?: {
    clientCount?: number;
    revenue?: number;
    bookingsThisWeek?: number;
    planId?: string;
  };
}

const SUGGESTED_PROMPTS = [
  "How can I get more clients this month?",
  "Write a follow-up email for an inactive client",
  "What should I charge for my services?",
  "Help me write an invoice description",
  "Tips to improve client retention",
];

export default function AIAssistant({ context }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your TrueAxis HQ Assistant. I can help you grow your business, write emails, understand your analytics, and answer any questions. What would you like to work on today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      }]);
    },
    onError: (e) => {
      toast.error("AI Assistant error: " + e.message);
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Trap focus in panel when open
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsOpen(false); }
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || chatMutation.isPending) return;
    setInput("");
    const newMessage: Message = { role: "user", content, timestamp: new Date() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    chatMutation.mutate({
      messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
      context,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Assistant"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full gradient-teal text-white shadow-lg hover:opacity-90 transition-all flex items-center justify-center animate-pulse-glow focus-visible:outline-[3px] focus-visible:outline-[#00C9A7] focus-visible:outline-offset-2"
        >
          <Sparkles className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="AI Business Assistant"
          className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: isMinimized ? "auto" : "520px" }}
        >
          {/* Header */}
          <div className="gradient-teal px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">AI Assistant</p>
                <p className="text-xs text-white/70">
                  {chatMutation.isPending ? "Thinking…" : "Online"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(m => !m)}
                aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" aria-hidden="true" /> : <Minimize2 className="w-4 h-4" aria-hidden="true" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Assistant"
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                role="log"
                aria-live="polite"
                aria-label="Chat messages"
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        msg.role === "assistant" ? "gradient-teal" : "bg-gray-200"
                      }`}
                      aria-hidden="true"
                    >
                      {msg.role === "assistant"
                        ? <Bot className="w-3.5 h-3.5 text-white" />
                        : <User className="w-3.5 h-3.5 text-gray-600" />
                      }
                    </div>
                    <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "assistant"
                            ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                            : "gradient-teal text-white rounded-tr-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <time
                        className="text-xs text-gray-400 px-1"
                        dateTime={msg.timestamp.toISOString()}
                        aria-label={`Sent at ${formatTime(msg.timestamp)}`}
                      >
                        {formatTime(msg.timestamp)}
                      </time>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {chatMutation.isPending && (
                  <div className="flex gap-2.5" role="status" aria-label="AI is thinking">
                    <div className="w-7 h-7 rounded-full gradient-teal flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              {/* Suggested prompts */}
              {messages.length === 1 && (
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto" role="list" aria-label="Suggested questions">
                  {SUGGESTED_PROMPTS.slice(0, 3).map((p, i) => (
                    <button
                      key={i}
                      role="listitem"
                      onClick={() => sendMessage(p)}
                      className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full transition-colors min-h-[36px] focus-visible:outline-[3px] focus-visible:outline-[#00C9A7]"
                      aria-label={`Ask: ${p}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="p-3 border-t border-gray-100 flex gap-2 items-end flex-shrink-0">
                <label htmlFor="ai-chat-input" className="sr-only">Message AI Assistant</label>
                <textarea
                  id="ai-chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your business…"
                  rows={1}
                  className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#00C9A7] focus:ring-2 focus:ring-[#00C9A7]/20 transition-colors"
                  aria-label="Type your message"
                  aria-describedby="ai-chat-hint"
                  disabled={chatMutation.isPending}
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                />
                <p id="ai-chat-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</p>
                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || chatMutation.isPending}
                  className="gradient-teal text-white border-0 rounded-xl w-11 h-11 p-0 flex-shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
