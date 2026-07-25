import { useState, useEffect, useRef, useCallback } from "react";
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
  savedActions?: Set<string>;
}

interface AIAssistantProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToPanel?: (panel: string) => void;
  /** When true, renders as an embedded full-panel (no fixed positioning, no drag) */
  panelMode?: boolean;
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

// ── Persist helpers ───────────────────────────────────────────────────────────
function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.x === "number" && typeof p.y === "number") return p;
    if (typeof p.left === "number" && typeof p.top === "number") return { x: p.left, y: p.top };
  } catch { /* ignore */ }
  return null;
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function clampPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth  - w - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
  return {
    x: Math.max(EDGE_MARGIN, Math.min(maxX, x)),
    y: Math.max(EDGE_MARGIN, Math.min(maxY, y)),
  };
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

// ── Action icon helper ────────────────────────────────────────────────────────
function ActionIcon({ type }: { type: SaveAction["type"] }) {
  if (type === "save_invoice_draft") return <FileText className="w-3.5 h-3.5" />;
  if (type === "save_contract_draft") return <FileSignature className="w-3.5 h-3.5" />;
  if (type === "save_followup_draft") return <Mail className="w-3.5 h-3.5" />;
  return <StickyNote className="w-3.5 h-3.5" />;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIAssistant({ visible, onClose, onNavigateToPanel, panelMode, context }: AIAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // ── Position: stored in a ref so drag handlers are NEVER stale ───────────────
  // We only sync to React state when we need a re-render (on drag end / expand).
  const initPos = (() => {
    const saved = loadPos();
    if (saved) return clampPos(saved.x, saved.y, BUBBLE_SIZE, BUBBLE_SIZE);
    return clampPos(
      window.innerWidth  - BUBBLE_SIZE - 24,
      window.innerHeight - BUBBLE_SIZE - 24,
      BUBBLE_SIZE, BUBBLE_SIZE
    );
  })();
  const posRef = useRef<{ x: number; y: number }>(initPos);
  // React state only for triggering re-render after drag ends
  const [renderPos, setRenderPos] = useState<{ x: number; y: number }>(initPos);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // Clamp whenever expanded changes
  useEffect(() => {
    const w = expanded ? PANEL_W : BUBBLE_SIZE;
    const h = expanded ? PANEL_H : BUBBLE_SIZE;
    const clamped = clampPos(posRef.current.x, posRef.current.y, w, h);
    posRef.current = clamped;
    savePos(clamped);
    setRenderPos(clamped);
  }, [expanded]);

  // Clamp on window resize
  useEffect(() => {
    const onResize = () => {
      const w = expandedRef.current ? PANEL_W : BUBBLE_SIZE;
      const h = expandedRef.current ? PANEL_H : BUBBLE_SIZE;
      const clamped = clampPos(posRef.current.x, posRef.current.y, w, h);
      posRef.current = clamped;
      savePos(clamped);
      setRenderPos(clamped);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Drag logic — all hot-path reads go through refs, NEVER closures ──────────
  const widgetRef  = useRef<HTMLDivElement>(null);
  const dragging   = useRef(false);
  const didMove    = useRef(false);
  // Offset from pointer to widget top-left at drag start
  const offsetRef  = useRef({ dx: 0, dy: 0 });
  // Snapshot of pos at drag start (from DOM, not state)
  const startPosRef = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    if (target.closest("button, textarea, input, a, select")) return;
    e.preventDefault();
    dragging.current  = true;
    didMove.current   = false;
    // Read position from DOM rect — immune to stale state
    const el = widgetRef.current;
    const rect = el ? el.getBoundingClientRect() : { left: posRef.current.x, top: posRef.current.y };
    startPosRef.current = { x: rect.left, y: rect.top };
    offsetRef.current   = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    if (el) el.setPointerCapture(e.pointerId);
  }, []); // ← empty deps: no stale closures

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    const w = expandedRef.current ? PANEL_W : BUBBLE_SIZE;
    const h = expandedRef.current ? PANEL_H : BUBBLE_SIZE;
    const newX = e.clientX - offsetRef.current.dx;
    const newY = e.clientY - offsetRef.current.dy;
    if (!didMove.current) {
      const dx = Math.abs(newX - startPosRef.current.x);
      const dy = Math.abs(newY - startPosRef.current.y);
      if (dx < 4 && dy < 4) return;
      didMove.current = true;
    }
    const clamped = clampPos(newX, newY, w, h);
    posRef.current = clamped;
    // Apply directly to DOM for zero-lag drag — no React re-render in hot path
    if (widgetRef.current) {
      widgetRef.current.style.left = `${clamped.x}px`;
      widgetRef.current.style.top  = `${clamped.y}px`;
    }
  }, []); // ← empty deps: reads only refs

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (didMove.current) {
      const w = expandedRef.current ? PANEL_W : BUBBLE_SIZE;
      let { x, y } = posRef.current;
      // Snap to nearest edge if within 80px
      const distLeft  = x - EDGE_MARGIN;
      const distRight = (window.innerWidth - EDGE_MARGIN) - (x + w);
      if (distLeft < 80 && distLeft <= distRight) x = EDGE_MARGIN;
      else if (distRight < 80 && distRight < distLeft) x = window.innerWidth - w - EDGE_MARGIN;
      const snapped = { x, y };
      posRef.current = snapped;
      savePos(snapped);
      // Now sync React state so next render uses correct position
      setRenderPos(snapped);
    }
  }, []); // ← empty deps

  const onPointerCancel = useCallback(() => { dragging.current = false; }, []);

  const dragProps = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };

  // ── Expand handler ─────────────────────────────────────────────────────────
  const handleExpand = () => {
    if (didMove.current) return;
    setExpanded(true);
  };

  // ── tRPC ──────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
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
    onError: (e) => toast.error("AI Assistant error: " + e.message),
  });

  const saveActionMutation = trpc.ai.saveAction.useMutation({
    onSuccess: (data) => {
      // Normalize legacy sub-panel ids to their consolidated parent panel
      const panelMap: Record<string, string> = {
        invoices: "billing", contracts: "deals", followups: "outreach",
        billing: "billing", deals: "deals", outreach: "outreach",
      };
      const resolvedPanel = panelMap[data.panel] ?? data.panel;
      const panelLabels: Record<string, string> = { billing: "Billing", deals: "Deals", outreach: "Outreach", insights: "Insights" };
      const panelName = panelLabels[resolvedPanel] ?? resolvedPanel;
      toast.success(`${data.label} saved!`, {
        description: `Saved to ${panelName}`,
        action: { label: `View in ${panelName}`, onClick: () => onNavigateToPanel?.(resolvedPanel) },
        duration: 6000,
      });
      if (data.panel === "invoices" || resolvedPanel === "billing")  utils.invoices.list.invalidate();
      if (data.panel === "contracts" || resolvedPanel === "deals")   utils.contracts?.list?.invalidate?.();
      if (data.panel === "followups" || resolvedPanel === "outreach") utils.followUps.list.invalidate();
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const handleSaveAction = (msgIndex: number, action: SaveAction) => {
    saveActionMutation.mutate({ type: action.type, data: action.data });
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex) return m;
      const saved = new Set(m.savedActions ?? []);
      saved.add(action.type);
      return { ...m, savedActions: saved };
    }));
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (!expanded) return; const t = setTimeout(() => inputRef.current?.focus(), 150); return () => clearTimeout(t); }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [expanded]);

  const sendMessage = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || chatMutation.isPending) return;
    setInput("");
    const newMessage: Message = { role: "user", content, timestamp: new Date() };
    const updated = [...messages, newMessage];
    setMessages(updated);
    // Cap history to last 20 messages to prevent token-limit errors and excessive API costs.
    // The full local history is preserved in `messages` state for display purposes.
    const historyToSend = updated.slice(-20).map(m => ({ role: m.role, content: m.content }));
    chatMutation.mutate({ messages: historyToSend, context });
  };

  const handleTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!visible) return null;

  const unreadCount = messages.filter(m => m.role === "assistant").length - 1;

  // ── Sub-components ─────────────────────────────────────────────────────────
  const MessageList = () => (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-4"
      role="log"
      aria-live="polite"
      style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
      onPointerDown={e => e.stopPropagation()}
    >
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === "assistant" ? "gradient-amber" : "bg-gray-200"}`}>
            {msg.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-gray-600" />}
          </div>
          <div className={`max-w-[82%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "assistant" ? "bg-gray-100 text-gray-800 rounded-tl-sm" : "gradient-amber text-white rounded-tr-sm"
            }`}>
              {msg.content}
            </div>
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
          <div className="bg-gray-100 rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const InputBar = () => (
    <div
      className="p-3 border-t border-gray-100 flex gap-2 items-end flex-shrink-0"
      onPointerDown={e => e.stopPropagation()}
      style={{ paddingBottom: isMobile ? "calc(0.75rem + env(safe-area-inset-bottom, 0px))" : undefined }}
    >
      <label htmlFor="ai-chat-input" className="sr-only">Message AI Assistant</label>
      <textarea
        id="ai-chat-input"
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleTextareaKey}
        placeholder="Ask anything, or say 'draft an invoice for…'"
        rows={1}
        maxLength={2000}
        className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#D4922A] focus:ring-2 focus:ring-[#D4922A]/20 transition-colors"
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

  const SuggestedPrompts = () => (
    messages.length === 1 ? (
      <div
        className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide"
        onPointerDown={e => e.stopPropagation()}
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

  const Header = ({ withDrag }: { withDrag?: boolean }) => (
    <div
      className="gradient-amber px-4 py-3 flex items-center justify-between flex-shrink-0 rounded-t-xl"
      style={{ cursor: withDrag ? "grab" : "default", touchAction: "none", userSelect: "none" }}
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
      <div className="flex items-center gap-1" onPointerDown={e => e.stopPropagation()}>
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

  // ── PANEL MODE: embedded in dashboard panel (no fixed positioning, no drag) ────
  if (panelMode) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-white rounded-xl overflow-hidden">
        {/* Panel header */}
        <div className="gradient-amber px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI Business Assistant</p>
              <p className="text-xs text-white/80">
                {chatMutation.isPending ? "Thinking…" : "Ask anything · drafts save directly to your panels"}
              </p>
            </div>
          </div>
        </div>
        <MessageList />
        <SuggestedPrompts />
        <InputBar />
      </div>
    );
  }

  // ── MOBILE: full-screen bottom sheet ──────────────────────────────────────
  if (isMobile) {
    if (!expanded) {
      return (
        <div style={{ position: "fixed", right: 16, bottom: 24, zIndex: 9999 }}>
          <button
            onClick={handleExpand}
            aria-label="Open AI Assistant"
            className="w-14 h-14 rounded-full gradient-amber text-white shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center relative"
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
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#1B2D4F] text-white flex items-center justify-center hover:bg-[#111E33] transition-colors shadow"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={() => setExpanded(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Business Assistant"
          className="fixed inset-x-0 bottom-0 z-[9999] bg-white flex flex-col rounded-t-2xl shadow-2xl"
          style={{ height: "85dvh", maxHeight: "85dvh" }}
        >
          <Header withDrag={false} />
          <MessageList />
          <SuggestedPrompts />
          <InputBar />
        </div>
      </>
    );
  }

  // ── DESKTOP: collapsed bubble ──────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        ref={widgetRef}
        style={{
          position: "fixed",
          left: renderPos.x,
          top: renderPos.y,
          zIndex: 9999,
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
          willChange: "left, top",
        }}
        {...dragProps}
      >
        <button
          onClick={handleExpand}
          aria-label="Open AI Assistant"
          className="w-14 h-14 rounded-full gradient-amber text-white shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center focus-visible:outline-[3px] focus-visible:outline-[#D4922A] focus-visible:outline-offset-2 relative"
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
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#1B2D4F] text-white flex items-center justify-center hover:bg-[#111E33] transition-colors shadow"
          style={{ pointerEvents: "auto" }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // ── DESKTOP: expanded floating panel ──────────────────────────────────────
  return (
    <div
      ref={widgetRef}
      role="dialog"
      aria-modal="true"
      aria-label="AI Business Assistant"
      style={{
        position: "fixed",
        left: renderPos.x,
        top: renderPos.y,
        zIndex: 9999,
        width: Math.min(PANEL_W, window.innerWidth - EDGE_MARGIN * 2),
        height: PANEL_H,
        touchAction: "none",
        userSelect: "none",
        willChange: "left, top",
      }}
      className="bg-white rounded-xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
    >
      <Header withDrag />
      <MessageList />
      <SuggestedPrompts />
      <InputBar />
    </div>
  );
}
