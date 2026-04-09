import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, User, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  /** When true the floating widget is visible. When false it is fully hidden. */
  visible: boolean;
  /** Called when the user taps X — parent should set visible=false */
  onClose: () => void;
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

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I'm your TrueAxis HQ Assistant. I can help you grow your business, write emails, understand your analytics, and answer any questions. What would you like to work on today?",
  timestamp: new Date(),
};

export default function AIAssistant({ visible, onClose, context }: AIAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Drag state ──────────────────────────────────────────────────────────────
  // Position is stored as { x, y } from the bottom-right corner (CSS right/bottom).
  const [pos, setPos] = useState({ x: 24, y: 24 }); // right: 24px, bottom: 24px
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const clamp = useCallback((val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val)), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag on the handle / bubble itself, not on buttons inside
    if ((e.target as HTMLElement).closest("button, textarea, input, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: pos.x,
      py: pos.y,
    };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    // Moving right → x decreases (right offset), moving down → y decreases (bottom offset)
    const newX = clamp(dragStart.current.px - dx, 8, window.innerWidth - 80);
    const newY = clamp(dragStart.current.py + dy, 8, window.innerHeight - 80);
    setPos({ x: newX, y: newY });
  }, [clamp]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // ── Chat logic ──────────────────────────────────────────────────────────────
  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, timestamp: new Date() },
      ]);
    },
    onError: (e) => {
      toast.error("AI Assistant error: " + e.message);
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [expanded]);

  // Keyboard trap + Escape
  useEffect(() => {
    if (!expanded) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || chatMutation.isPending) return;
    setInput("");
    const newMessage: Message = { role: "user", content, timestamp: new Date() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    chatMutation.mutate({
      messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
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

  // When not visible, render nothing at all
  if (!visible) return null;

  const unreadCount = messages.filter((m) => m.role === "assistant").length - 1;

  // ── Collapsed bubble ────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        style={{
          position: "fixed",
          right: pos.x,
          bottom: pos.y,
          zIndex: 9999,
          touchAction: "none",
          userSelect: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Bubble */}
        <button
          onClick={() => setExpanded(true)}
          aria-label="Open AI Assistant"
          className="w-14 h-14 rounded-full gradient-amber text-white shadow-xl hover:opacity-90 transition-all flex items-center justify-center focus-visible:outline-[3px] focus-visible:outline-[#E8A020] focus-visible:outline-offset-2 relative"
          style={{ cursor: "grab" }}
        >
          <Sparkles className="w-6 h-6" aria-hidden="true" />
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Close button — small X above the bubble */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Dismiss AI Assistant"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-gray-900 transition-colors shadow"
          style={{ fontSize: 10 }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // ── Expanded chat panel ─────────────────────────────────────────────────────
  // On mobile the panel is full-width at the bottom; on desktop it floats.
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="AI Business Assistant"
      style={{
        position: "fixed",
        right: pos.x,
        bottom: pos.y,
        zIndex: 9999,
        width: "min(380px, calc(100vw - 2rem))",
        height: 520,
        touchAction: "none",
        userSelect: "none",
      }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
    >
      {/* Drag handle / header */}
      <div
        className="gradient-amber px-4 py-3 flex items-center justify-between flex-shrink-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="flex items-center gap-2.5">
          <GripHorizontal className="w-4 h-4 text-white/50 flex-shrink-0" aria-hidden="true" />
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI Assistant</p>
            <p className="text-xs text-white/70">
              {chatMutation.isPending ? "Thinking…" : "Online · drag to move"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(false)}
            aria-label="Minimize chat"
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <Minimize2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        style={{ touchAction: "pan-y" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === "assistant" ? "gradient-amber" : "bg-gray-200"
              }`}
              aria-hidden="true"
            >
              {msg.role === "assistant"
                ? <Bot className="w-3.5 h-3.5 text-white" />
                : <User className="w-3.5 h-3.5 text-gray-600" />}
            </div>
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                    : "gradient-amber text-white rounded-tr-sm"
                }`}
              >
                {msg.content}
              </div>
              <time
                className="text-xs text-gray-400 px-1"
                dateTime={msg.timestamp.toISOString()}
              >
                {formatTime(msg.timestamp)}
              </time>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-2.5" role="status" aria-label="AI is thinking">
            <div className="w-7 h-7 rounded-full gradient-amber flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
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
              className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full transition-colors min-h-[36px]"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100 flex gap-2 items-end flex-shrink-0" style={{ touchAction: "none" }}>
        <label htmlFor="ai-chat-input" className="sr-only">Message AI Assistant</label>
        <textarea
          id="ai-chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your business…"
          rows={1}
          className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#E8A020] focus:ring-2 focus:ring-[#E8A020]/20 transition-colors"
          disabled={chatMutation.isPending}
          style={{ minHeight: 44, maxHeight: 120, touchAction: "pan-y" }}
        />
        <Button
          onClick={() => sendMessage()}
          disabled={!input.trim() || chatMutation.isPending}
          className="gradient-amber text-white border-0 rounded-xl w-11 h-11 p-0 flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
