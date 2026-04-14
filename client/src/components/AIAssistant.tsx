import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bot, Send, X, Minimize2, Sparkles, User, GripHorizontal, FileText, FileSignature, Mail, StickyNote, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SaveAction {
  type: "save_invoice_draft" | "save_contract_draft" | "save_followup_draft" | "save_note";
  label: string;
  data: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: SaveAction[];
  savedActions?: Set<string>; // track which have been saved
}

interface AIAssistantProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToPanel?: (panel: string) => void;
  context?: {
    clientCount?: number;
    revenue?: number;
    bookingsThisWeek?: number;
    planId?: string;
    activePanel?: string;
  };
}

const SUGGESTED_PROMPTS = [
  "How can I get more clients this month?",
  "Write a follow-up email for an inactive client",
  "Draft an invoice for a 3-hour consulting session at $150/hr",
  "Create a simple service contract for a design project",
  "Tips to improve client retention",
];

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I'm your TrueAxis HQ Assistant. I can write follow-up emails, draft invoices and contracts, give business advice, and save anything directly to your dashboard with one tap. What would you like to work on?",
  timestamp: new Date(),
};

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "trueaxis-ai-widget-pos";
const BUBBLE_SIZE = 56;
const PANEL_W = 390;
const PANEL_H = 540;
const EDGE_MARGIN = 12;
const SNAP_THRESHOLD = 80;

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

function clamp(pos: { left: number; top: number }, w: number, h: number) {
  const maxLeft = Math.max(0, window.innerWidth  - w - EDGE_MARGIN);
  const maxTop  = Math.max(0, window.innerHeight - h - EDGE_MARGIN);
  return {
    left: Math.max(EDGE_MARGIN, Math.min(maxLeft, pos.left)),
    top:  Math.max(EDGE_MARGIN, Math.min(maxTop,  pos.top)),
  };
}

function snapToEdge(pos: { left: number; top: number }, w: number) {
  const distLeft  = pos.left - EDGE_MARGIN;
  const distRight = (window.innerWidth - EDGE_MARGIN) - (pos.left + w);
  if (distLeft < SNAP_THRESHOLD && distLeft <= distRight) return { ...pos, left: EDGE_MARGIN };
  if (distRight < SNAP_THRESHOLD && distRight < distLeft) return { ...pos, left: window.innerWidth - w - EDGE_MARGIN };
  return pos;
}

// ── Mobile detection ──────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ── Draggable hook (desktop only) ─────────────────────────────────────────────
function useDraggable(expanded: boolean) {
  const size = expanded ? { w: PANEL_W, h: PANEL_H } : { w: BUBBLE_SIZE, h: BUBBLE_SIZE };

  const [pos, setPos] = useState<{ left: number; top: number }>(() => {
    const saved = loadPos();
    if (saved) return clamp(saved, size.w, size.h);
    return clamp(
      { left: window.innerWidth - BUBBLE_SIZE - 24, top: window.innerHeight - BUBBLE_SIZE - 24 },
      size.w, size.h
    );
  });

  useEffect(() => {
    setPos(prev => {
      const clamped = clamp(prev, size.w, size.h);
      savePos(clamped);
      return clamped;
    });
  }, [expanded, size.w, size.h]);

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
    if (e.button !== 0 && e.pointerType === "mouse") return;
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
    if (!didMove.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    didMove.current = true;
    setPos(clamp({ left: startPos.current.left + dx, top: startPos.current.top + dy }, size.w, size.h));
  }, [size.w, size.h]);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (didMove.current) {
      setPos(prev => {
        const snapped = snapToEdge(clamp(prev, size.w, size.h), size.w);
        savePos(snapped);
        return snapped;
      });
    }
  }, [size.w, size.h]);

  const onPointerCancel = useCallback(() => { isDragging.current = false; }, []);

  return {
    pos, setPos, elementRef, didMove,
    dragProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

// ── Action icon helper ────────────────────────────────────────────────────────
function ActionIcon({ type }: { type: SaveAction["type"] }) {
  if (type === "save_invoice_draft") return <FileText className="w-3.5 h-3.5" />;
  if (type === "save_contract_draft") return <FileSignature className="w-3.5 h-3.5" />;
  if (type === "save_followup_draft") return <Mail className="w-3.5 h-3.5" />;
  return <StickyNote className="w-3.5 h-3.5" />;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIAssistant({ visible, onClose, onNavigateToPanel, context }: AIAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  const { pos, setPos, elementRef, didMove, dragProps } = useDraggable(expanded);

  const handleExpand = () => {
    setExpanded(true);
    if (!isMobile) {
      setPos(prev => {
        const clamped = clamp(prev, PANEL_W, PANEL_H);
        savePos(clamped);
        return clamped;
      });
    }
  };

  const utils = trpc.useUtils();

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data, variables) => {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
          actions: (data.actions ?? []) as SaveAction[],
          savedActions: new Set(),
        },
      ]);
    },
    onError: (e) => {
      toast.error("AI Assistant error: " + e.message);
    },
  });

  const saveActionMutation = trpc.ai.saveAction.useMutation({
    onSuccess: (data, variables) => {
      const panelLabels: Record<string, string> = {
        invoices: "Invoices",
        contracts: "Contracts",
        followups: "Follow-ups",
      };
      const panelName = panelLabels[data.panel] ?? data.panel;
      toast.success(`${data.label} saved!`, {
        description: `Saved to ${panelName}`,
        action: {
          label: `View in ${panelName}`,
          onClick: () => onNavigateToPanel?.(data.panel),
        },
        duration: 6000,
      });
      // Invalidate relevant queries
      if (data.panel === "invoices") utils.invoices.list.invalidate();
      if (data.panel === "contracts") utils.contracts?.list?.invalidate?.();
      if (data.panel === "followups") utils.followUps.list.invalidate();
    },
    onError: (e) => {
      toast.error("Save failed: " + e.message);
    },
  });

  const handleSaveAction = (msgIndex: number, action: SaveAction) => {
    saveActionMutation.mutate({ type: action.type, data: action.data });
    // Mark as saved in UI
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex) return m;
      const saved = new Set(m.savedActions ?? []);
      saved.add(action.type);
      return { ...m, savedActions: saved };
    }));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 150);
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

  // ── Collapsed bubble (same for mobile + desktop) ───────────────────────────
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
          cursor: isMobile ? "pointer" : "grab",
          willChange: "transform",
        }}
        {...(isMobile ? {} : dragProps)}
      >
        <button
          onClick={() => { if (!didMove.current) handleExpand(); }}
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

  // ── Message list (shared) ──────────────────────────────────────────────────
  const MessageList = () => (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-4"
      role="log"
      aria-live="polite"
      style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
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
          <div className={`max-w-[82%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "assistant"
                ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                : "gradient-amber text-white rounded-tr-sm"
            }`}>
              {msg.content}
            </div>

            {/* Save action buttons */}
            {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {msg.actions.map((action, ai) => {
                  const isSaved = msg.savedActions?.has(action.type);
                  return (
                    <button
                      key={ai}
                      onClick={() => !isSaved && handleSaveAction(i, action)}
                      disabled={isSaved || saveActionMutation.isPending}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                        isSaved
                          ? "bg-green-100 text-green-700 cursor-default"
                          : "bg-[#00C9A7]/10 text-[#00C9A7] hover:bg-[#00C9A7]/20 active:scale-95 border border-[#00C9A7]/30"
                      }`}
                    >
                      {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ActionIcon type={action.type} />}
                      {isSaved ? "Saved!" : action.label}
                    </button>
                  );
                })}
              </div>
            )}

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
  );

  // ── Input bar (shared) ─────────────────────────────────────────────────────
  const InputBar = () => (
    <div
      className="p-3 border-t border-gray-100 flex gap-2 items-end flex-shrink-0"
      onPointerDown={(e) => e.stopPropagation()}
      style={{ paddingBottom: isMobile ? "calc(0.75rem + env(safe-area-inset-bottom, 0px))" : undefined }}
    >
      <label htmlFor="ai-chat-input" className="sr-only">Message AI Assistant</label>
      <textarea
        id="ai-chat-input"
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleTextareaKey}
        placeholder="Ask anything, or say 'draft an invoice for…'"
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
  );

  // ── Suggested prompts (shared) ─────────────────────────────────────────────
  const SuggestedPrompts = () => (
    messages.length === 1 ? (
      <div
        className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide"
        onPointerDown={(e) => e.stopPropagation()}
        style={{ touchAction: "pan-x" }}
      >
        {SUGGESTED_PROMPTS.slice(0, 4).map((p, i) => (
          <button
            key={i}
            onClick={() => sendMessage(p)}
            className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full transition-colors min-h-[36px]"
          >
            {p}
          </button>
        ))}
      </div>
    ) : null
  );

  // ── Header (shared) ────────────────────────────────────────────────────────
  const Header = ({ withDrag }: { withDrag?: boolean }) => (
    <div
      className="gradient-amber px-4 py-3 flex items-center justify-between flex-shrink-0"
      style={{ cursor: withDrag ? "grab" : "default" }}
      {...(withDrag ? dragProps : {})}
    >
      <div className="flex items-center gap-2.5 pointer-events-none">
        {withDrag && <GripHorizontal className="w-4 h-4 text-white/50 flex-shrink-0" />}
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">AI Assistant</p>
          <p className="text-xs text-white/80">
            {chatMutation.isPending ? "Thinking…" : withDrag ? "Drag to move · tap to save drafts" : "Tap to save drafts to dashboard"}
          </p>
        </div>
      </div>
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
  );

  // ── MOBILE: full-screen bottom sheet ──────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 z-[9998]"
          onClick={() => setExpanded(false)}
        />
        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Business Assistant"
          className="fixed inset-x-0 bottom-0 z-[9999] bg-white flex flex-col rounded-t-2xl shadow-2xl"
          style={{
            height: "85dvh",
            maxHeight: "85dvh",
          }}
        >
          <Header withDrag={false} />
          <MessageList />
          <SuggestedPrompts />
          <InputBar />
        </div>
      </>
    );
  }

  // ── DESKTOP: draggable floating panel ─────────────────────────────────────
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
      <Header withDrag />
      <MessageList />
      <SuggestedPrompts />
      <InputBar />
    </div>
  );
}
