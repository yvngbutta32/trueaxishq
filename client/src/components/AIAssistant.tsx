import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bot, Send, X, Minimize2, Sparkles, User, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  visible: boolean;
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

const STORAGE_KEY = "trueaxis-ai-widget-pos";
const BUBBLE_SIZE = 56;   // w-14 h-14
const PANEL_W = 380;
const PANEL_H = 520;
const EDGE_MARGIN = 16;   // minimum distance from screen edge
const SNAP_THRESHOLD = 80; // px from edge to trigger snap

// ── Persist helpers ───────────────────────────────────────────────────────────
function loadPos(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.left === "number" && typeof p.top === "number") return p;
  } catch { /* ignore */ }
  return null;
}

function savePos(pos: { left: number; top: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

// Clamp position so the widget stays fully on-screen
function clamp(pos: { left: number; top: number }, w: number, h: number) {
  const maxLeft = Math.max(0, window.innerWidth  - w - EDGE_MARGIN);
  const maxTop  = Math.max(0, window.innerHeight - h - EDGE_MARGIN);
  return {
    left: Math.max(EDGE_MARGIN, Math.min(maxLeft, pos.left)),
    top:  Math.max(EDGE_MARGIN, Math.min(maxTop,  pos.top)),
  };
}

// Snap to nearest horizontal edge if within SNAP_THRESHOLD
function snapToEdge(pos: { left: number; top: number }, w: number) {
  const distLeft  = pos.left - EDGE_MARGIN;
  const distRight = (window.innerWidth - EDGE_MARGIN) - (pos.left + w);
  if (distLeft < SNAP_THRESHOLD && distLeft <= distRight) {
    return { ...pos, left: EDGE_MARGIN };
  }
  if (distRight < SNAP_THRESHOLD && distRight < distLeft) {
    return { ...pos, left: window.innerWidth - w - EDGE_MARGIN };
  }
  return pos;
}

// ── Draggable hook ────────────────────────────────────────────────────────────
function useDraggable(expanded: boolean) {
  const size = expanded ? { w: PANEL_W, h: PANEL_H } : { w: BUBBLE_SIZE, h: BUBBLE_SIZE };

  const getDefaultPos = () => clamp(
    { left: window.innerWidth - BUBBLE_SIZE - 24, top: window.innerHeight - BUBBLE_SIZE - 24 },
    size.w, size.h
  );

  const [pos, setPos] = useState<{ left: number; top: number }>(() => {
    const saved = loadPos();
    if (saved) return clamp(saved, size.w, size.h);
    return getDefaultPos();
  });

  // Re-clamp whenever expanded state or viewport changes
  useEffect(() => {
    setPos(prev => {
      const clamped = clamp(prev, size.w, size.h);
      savePos(clamped);
      return clamped;
    });
  }, [expanded, size.w, size.h]);

  // Re-clamp on window resize
  useEffect(() => {
    const onResize = () => {
      setPos(prev => {
        const clamped = clamp(prev, size.w, size.h);
        savePos(clamped);
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  const isDragging = useRef(false);
  const didMove    = useRef(false);
  const startPtr   = useRef({ x: 0, y: 0 });
  const startPos   = useRef({ left: 0, top: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // Only drag on primary button / single touch
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Don't start drag on interactive children
    const target = e.target as HTMLElement;
    if (target.closest("button, textarea, input, a, select")) return;

    e.preventDefault();
    isDragging.current = true;
    didMove.current    = false;
    startPtr.current   = { x: e.clientX, y: e.clientY };
    startPos.current   = { ...pos };

    const el = elementRef.current;
    if (el) el.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startPtr.current.x;
    const dy = e.clientY - startPtr.current.y;

    // Only start moving after 4px threshold (prevents accidental drags on click)
    if (!didMove.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    didMove.current = true;

    const newPos = clamp(
      { left: startPos.current.left + dx, top: startPos.current.top + dy },
      size.w, size.h
    );
    setPos(newPos);
  }, [size.w, size.h]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (didMove.current) {
      // Snap to nearest edge and persist
      setPos(prev => {
        const snapped = snapToEdge(clamp(prev, size.w, size.h), size.w);
        savePos(snapped);
        return snapped;
      });
    }
  }, [size.w, size.h]);

  const onPointerCancel = useCallback(() => {
    isDragging.current = false;
  }, []);

  return {
    pos,
    setPos,
    elementRef,
    didMove,
    dragProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIAssistant({ visible, onClose, context }: AIAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { pos, setPos, elementRef, didMove, dragProps } = useDraggable(expanded);

  // When expanding, adjust position so the full panel fits on screen
  const handleExpand = () => {
    setExpanded(true);
    setPos(prev => {
      const clamped = clamp(prev, PANEL_W, PANEL_H);
      savePos(clamped);
      return clamped;
    });
  };

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 100);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
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
    const updated = [...messages, newMessage];
    setMessages(updated);
    chatMutation.mutate({
      messages: updated.map((m) => ({ role: m.role, content: m.content })),
      context,
    });
  };

  const handleTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!visible) return null;

  const unreadCount = messages.filter((m) => m.role === "assistant").length - 1;

  // ── Collapsed bubble ───────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        ref={elementRef}
        style={{
          position: "fixed",
          left: pos.left,
          top: pos.top,
          zIndex: 9999,
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
          willChange: "transform",
        }}
        {...dragProps}
      >
        {/* Main bubble — click to expand (only if not dragging) */}
        <button
          onClick={() => {
            if (!didMove.current) handleExpand();
          }}
          aria-label="Open AI Assistant"
          className="w-14 h-14 rounded-full gradient-amber text-white shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center focus-visible:outline-[3px] focus-visible:outline-[#E8A020] focus-visible:outline-offset-2 relative"
          style={{ cursor: "inherit", pointerEvents: "auto" }}
        >
          <Sparkles className="w-6 h-6" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dismiss X — small badge above bubble */}
        <button
          onClick={onClose}
          aria-label="Dismiss AI Assistant"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-gray-900 transition-colors shadow"
          style={{ pointerEvents: "auto" }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // ── Expanded chat panel ────────────────────────────────────────────────────
  return (
    <div
      ref={elementRef}
      role="dialog"
      aria-modal="true"
      aria-label="AI Business Assistant"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 9999,
        width: Math.min(PANEL_W, window.innerWidth - EDGE_MARGIN * 2),
        height: PANEL_H,
        touchAction: "none",
        userSelect: "none",
        willChange: "transform",
      }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
    >
      {/* ── Drag handle header ── */}
      <div
        className="gradient-amber px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ cursor: "grab" }}
        {...dragProps}
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
          <GripHorizontal className="w-4 h-4 text-white/50 flex-shrink-0" />
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI Assistant</p>
            <p className="text-xs text-white/70">
              {chatMutation.isPending ? "Thinking…" : "Online · drag to move"}
            </p>
          </div>
        </div>

        {/* Buttons — stop propagation so clicks don't start drag */}
        <div
          className="flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setExpanded(false)}
            aria-label="Minimize chat"
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === "assistant" ? "gradient-amber" : "bg-gray-200"
              }`}
            >
              {msg.role === "assistant"
                ? <Bot className="w-3.5 h-3.5 text-white" />
                : <User className="w-3.5 h-3.5 text-gray-600" />}
            </div>
            <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                  : "gradient-amber text-white rounded-tr-sm"
              }`}>
                {msg.content}
              </div>
              <time className="text-xs text-gray-400 px-1" dateTime={msg.timestamp.toISOString()}>
                {formatTime(msg.timestamp)}
              </time>
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex gap-2.5" role="status" aria-label="AI is thinking">
            <div className="w-7 h-7 rounded-full gradient-amber flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggested prompts ── */}
      {messages.length === 1 && (
        <div
          className="px-4 pb-2 flex gap-2 overflow-x-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {SUGGESTED_PROMPTS.slice(0, 3).map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full transition-colors min-h-[36px]"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div
        className="p-3 border-t border-gray-100 flex gap-2 items-end flex-shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <label htmlFor="ai-chat-input" className="sr-only">Message AI Assistant</label>
        <textarea
          id="ai-chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleTextareaKey}
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
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
