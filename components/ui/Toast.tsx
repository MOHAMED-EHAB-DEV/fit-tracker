"use client";

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { OVERLAY_ROOT_ATTRIBUTE } from "@/lib/ui/overlay-stack";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => undefined;

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  /** Short verb: "Undo", "Retry", "View". */
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Milliseconds on screen. Defaults: 7s for errors and actions, 5s warnings, 3.5s otherwise. */
  duration?: number;
  /** One button inside the toast (Undo after a delete). The toast closes when it is pressed. */
  action?: ToastAction;
}

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
  exiting?: boolean;
  /** When the current timer segment started. */
  startedAt?: number;
  /** Time left when the timer was last paused. */
  remaining?: number;
}

interface ToastContextValue {
  /**
   * Shows a toast and returns its id. The third argument is either a
   * duration in ms (older call sites) or { duration, action }.
   */
  toast: (message: string, variant?: ToastVariant, options?: number | ToastOptions) => string;
  /** Closes a toast early (e.g. once the deletion it offered to undo is final). */
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const MAX_VISIBLE_TOASTS = 3;
const EXIT_DURATION = 220;

interface VariantStyle {
  icon: React.ReactNode;
  /** Status colour for the icon only. */
  iconClass: string;
  /** "alert" for urgent (error / warning), "status" for the rest. */
  role: "alert" | "status";
  liveMode: "assertive" | "polite";
}

const VARIANTS: Record<ToastVariant, VariantStyle> = {
  success: {
    icon: <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" />,
    iconClass: "text-ok",
    role: "status",
    liveMode: "polite",
  },
  error: {
    icon: <AlertCircle className="h-[18px] w-[18px]" aria-hidden="true" />,
    iconClass: "text-danger",
    role: "alert",
    liveMode: "assertive",
  },
  warning: {
    icon: <TriangleAlert className="h-[18px] w-[18px]" aria-hidden="true" />,
    iconClass: "text-warn",
    role: "alert",
    liveMode: "assertive",
  },
  info: {
    icon: <Info className="h-[18px] w-[18px]" aria-hidden="true" />,
    iconClass: "text-ink-2",
    role: "status",
    liveMode: "polite",
  },
};

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
  const style = VARIANTS[item.variant];

  return (
    <div
      role={style.role}
      aria-live={style.liveMode}
      aria-atomic="true"
      onMouseEnter={() => onPause(item.id)}
      onMouseLeave={() => onResume(item.id)}
      onFocus={() => onPause(item.id)}
      onBlur={() => onResume(item.id)}
      onTouchStart={() => onPause(item.id)}
      onTouchEnd={() => onResume(item.id)}
      className={cn(
        "glass-float pointer-events-auto flex w-full min-h-12 items-center gap-2.5 rounded-control py-1.5 ps-3 pe-1.5 text-sm font-medium text-ink",
        item.exiting ? "toast-exit" : "toast-enter"
      )}
    >
      <span className={cn("flex shrink-0", style.iconClass)}>{style.icon}</span>
      <span className="min-w-0 flex-1 py-1.5 leading-5">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onRemove(item.id);
          }}
          className="inline-flex min-h-9 shrink-0 items-center rounded-chip px-3 text-sm font-semibold text-accent transition-colors hover:bg-elevated cursor-pointer"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="Dismiss notification"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-chip text-ink-3 transition-colors hover:bg-elevated hover:text-ink cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
});

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
  // False on the server and during hydration, true afterwards.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  if (!mounted || items.length === 0) return null;

  return createPortal(
    <div
      aria-label="Notifications"
      {...{ [OVERLAY_ROOT_ATTRIBUTE]: "" }}
      // In the thumb zone: just above the tab bar, the minimised workout or the
      // live-session dock (--dock-height), never at the top of the screen.
      className="toast-region pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-3"
    >
      <div className="flex w-full max-w-[420px] flex-col gap-2">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onRemove={onRemove} onPause={onPause} onResume={onResume} />
        ))}
      </div>
    </div>,
    document.body
  );
}

let uid = 0;
function nextId() {
  uid += 1;
  return `toast-${uid}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(id);
    }
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    const exit = setTimeout(() => {
      setItems((prev) => prev.filter((toast) => toast.id !== id));
      timers.current.delete(`exit-${id}`);
    }, EXIT_DURATION);
    timers.current.set(`exit-${id}`, exit);
  }, []);

  const scheduleRemove = useCallback(
    (id: string, delay: number) => {
      timers.current.set(
        id,
        setTimeout(() => remove(id), delay)
      );
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
        if (!item || item.exiting || timers.current.has(id)) return prev;
        const remaining = item.remaining ?? item.duration;
        if (remaining <= 0) {
          setTimeout(() => remove(id), 0);
          return prev;
        }
        scheduleRemove(id, remaining);
        return prev.map((t) => (t.id === id ? { ...t, startedAt: Date.now() } : t));
      });
    },
    [remove, scheduleRemove]
  );

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", options?: number | ToastOptions) => {
      const opts: ToastOptions = typeof options === "number" ? { duration: options } : options || {};
      // Errors and toasts with an action stay long enough to be read and used.
      const duration =
        opts.duration ?? (variant === "error" || opts.action ? 7000 : variant === "warning" ? 5000 : 3500);
      const id = nextId();
      const now = Date.now();

      setItems((prev) => {
        let next = [...prev];
        const active = next.filter((t) => !t.exiting);
        if (active.length >= MAX_VISIBLE_TOASTS) {
          const oldest = active[0];
          next = next.map((t) => (t.id === oldest.id ? { ...t, exiting: true } : t));
          setTimeout(() => setItems((p) => p.filter((t) => t.id !== oldest.id)), EXIT_DURATION);
        }
        return [...next, { id, message, variant, duration, action: opts.action, startedAt: now, remaining: duration }];
      });

      scheduleRemove(id, duration);
      return id;
    },
    [scheduleRemove]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss: remove }), [toast, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer items={items} onRemove={remove} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}
