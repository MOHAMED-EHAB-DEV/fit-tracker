"use client";

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  exiting?: boolean;
  /** internal — timestamp when the current timer segment started */
  startedAt?: number;
  /** internal — ms remaining when last paused */
  remaining?: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MAX_VISIBLE_TOASTS = 5;
const EXIT_DURATION = 280;

// ─────────────────────────────────────────────
// Variant config — static, never recreated
// ─────────────────────────────────────────────

interface VariantStyle {
  border: string;
  iconColor: string;
  glow: string;
  /** ARIA role — "alert" for urgent (error/warning), "status" for info/success */
  role: "alert" | "status";
  /** aria-live — "assertive" for urgent, "polite" for non-urgent */
  liveMode: "assertive" | "polite";
}

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: {
    border: "rgba(16, 185, 129, 0.35)",
    iconColor: "#34d399",
    glow: "rgba(16, 185, 129, 0.12)",
    role: "status",
    liveMode: "polite",
  },
  error: {
    border: "rgba(239, 68, 68, 0.35)",
    iconColor: "#f87171",
    glow: "rgba(239, 68, 68, 0.10)",
    role: "alert",
    liveMode: "assertive",
  },
  warning: {
    border: "rgba(234, 179, 8, 0.35)",
    iconColor: "#facc15",
    glow: "rgba(234, 179, 8, 0.10)",
    role: "alert",
    liveMode: "assertive",
  },
  info: {
    border: "rgba(99, 102, 241, 0.35)",
    iconColor: "#818cf8",
    glow: "rgba(99, 102, 241, 0.10)",
    role: "status",
    liveMode: "polite",
  },
};

/** Icons rendered once per variant — stable references */
const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
  error: <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
  warning: <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />,
  info: <Info className="w-4 h-4 shrink-0" aria-hidden="true" />,
};

// ─────────────────────────────────────────────
// Static styles — extracted to avoid re-creation
// ─────────────────────────────────────────────

const dismissBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "22px",
  height: "22px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: "#71717a",
  cursor: "pointer",
  transition: "color 0.15s, background 0.15s",
};

const dismissIconStyle: React.CSSProperties = { width: "13px", height: "13px" };

const containerStyle: React.CSSProperties = {
  position: "fixed",
  top: "max(1rem, env(safe-area-inset-top))",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "center",
  pointerEvents: "none",
};

// ─────────────────────────────────────────────
// Single Toast Card — memoized
// ─────────────────────────────────────────────

const ToastCard = memo(function ToastCard({
  item,
  onRemove,
  onPause,
  onResume,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const cfg = VARIANT_STYLES[item.variant];

  const cardStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px 10px 12px",
    borderRadius: "16px",
    background: "rgba(9, 9, 11, 0.92)",
    border: `1px solid ${cfg.border}`,
    boxShadow: `0 8px 32px -4px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 40px 0 ${cfg.glow}`,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    color: "#f4f4f5",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.4,
    maxWidth: "360px",
    minWidth: "220px",
    pointerEvents: "all",
    userSelect: "none",
  };

  return (
    <div
      role={cfg.role}
      aria-live={cfg.liveMode}
      aria-atomic="true"
      className={item.exiting ? "toast-exit" : "toast-enter"}
      onMouseEnter={() => onPause(item.id)}
      onMouseLeave={() => onResume(item.id)}
      style={cardStyle}
    >
      {/* Decorative icon — hidden from screen readers */}
      <span style={{ color: cfg.iconColor, flexShrink: 0, display: "flex" }}>
        {VARIANT_ICONS[item.variant]}
      </span>

      {/* Message */}
      <span style={{ flex: 1 }}>{item.message}</span>

      {/* Dismiss — visible focus ring for keyboard users */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="Dismiss notification"
        className="toast-dismiss-btn"
        style={dismissBtnStyle}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.color = "#f4f4f5";
          el.style.background = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.color = "#71717a";
          el.style.background = "transparent";
        }}
      >
        <X style={dismissIconStyle} aria-hidden="true" />
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────
// Portal container
// ─────────────────────────────────────────────

function ToastContainer({
  items,
  onRemove,
  onPause,
  onResume,
}: {
  items: ToastItem[];
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || items.length === 0) return null;

  return createPortal(
    <div aria-label="Notifications" style={containerStyle}>
      {items.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onRemove={onRemove}
          onPause={onPause}
          onResume={onResume}
        />
      ))}
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

let _uid = 0;
function genId() {
  return `toast-${++_uid}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    // Clear any pending auto-dismiss timer
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(id);
    }

    // Start exit animation
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove from DOM after animation
    const t = setTimeout(() => {
      setItems((prev) => prev.filter((toast) => toast.id !== id));
      timers.current.delete(`exit-${id}`);
    }, EXIT_DURATION);
    timers.current.set(`exit-${id}`, t);
  }, []);

  const scheduleRemove = useCallback(
    (id: string, delay: number) => {
      const t = setTimeout(() => remove(id), delay);
      timers.current.set(id, t);
    },
    [remove]
  );

  const pause = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (!t) return;
    clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const elapsed = item.startedAt ? Date.now() - item.startedAt : 0;
        const remaining = Math.max(0, (item.remaining ?? item.duration) - elapsed);
        return { ...item, remaining, startedAt: undefined };
      })
    );
  }, []);

  const resume = useCallback(
    (id: string) => {
      setItems((prev) => {
        const item = prev.find((t) => t.id === id);
        if (!item || item.exiting) return prev;
        const remaining = item.remaining ?? item.duration;
        if (remaining <= 0) {
          setTimeout(() => remove(id), 0);
          return prev;
        }
        scheduleRemove(id, remaining);
        return prev.map((t) =>
          t.id === id ? { ...t, startedAt: Date.now() } : t
        );
      });
    },
    [remove, scheduleRemove]
  );

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 3000) => {
      const id = genId();
      const now = Date.now();

      setItems((prev) => {
        // Evict oldest non-exiting toasts when at capacity
        let next = [...prev];
        const active = next.filter((t) => !t.exiting);
        if (active.length >= MAX_VISIBLE_TOASTS) {
          const oldest = active[0];
          // Immediately mark for exit
          next = next.map((t) =>
            t.id === oldest.id ? { ...t, exiting: true } : t
          );
          setTimeout(() => {
            setItems((p) => p.filter((t) => t.id !== oldest.id));
          }, EXIT_DURATION);
        }
        return [
          ...next,
          { id, message, variant, duration, startedAt: now, remaining: duration },
        ];
      });

      scheduleRemove(id, duration);
    },
    [scheduleRemove]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer items={items} onRemove={remove} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}
