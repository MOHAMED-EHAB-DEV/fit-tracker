"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  Loader2,
  UtensilsCrossed,
  Database,
  Dumbbell,
  Scale,
  TrendingUp,
  Activity,
  Zap,
  HelpCircle,
  Trash2,
  SlidersHorizontal,
  Paperclip,
  Reply,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
  Image as ImageIcon,
  AlertCircle,
  Square,
  RotateCw,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/context/UserContext";
import { Markdown } from "@/components/coach/Markdown";
import { ProposalCard } from "@/components/coach/ProposalCard";
import { readApiResponse } from "@/lib/assistant/http";
import { prepareUpload } from "@/lib/assistant/image-resize";
import {
  loadHistory,
  recentTurns,
  saveHistory,
  type CoachMessage,
  type ProposalState,
  type StoredAttachment,
  type StoredQuote,
} from "@/lib/assistant/chat-storage";
import { CHAT_LIMITS } from "@/lib/validation/assistant";
import type {
  ChatAttachmentPayload,
  ChatRequestBody,
  ChatResponseBody,
  CommitResponseBody,
  LogProposal,
} from "@/lib/assistant/types";
import { formatTimeInZone, localDateString, resolveTimeZone } from "@/lib/time";

interface CommandDef {
  name: string;
  syntax: string;
  description: string;
  category: "data" | "analysis" | "utility";
  icon: typeof Sparkles;
  defaultDays?: number;
  dayOptions?: number[];
  samplePrompt?: string;
}

const COMMAND_DEFINITIONS: CommandDef[] = [
  { name: "/data meals", syntax: "/data meals [days]", description: "Meals, macro averages and calorie adherence", category: "data", icon: UtensilsCrossed, defaultDays: 30, dayOptions: [7, 14, 30, 60], samplePrompt: "Which days was my protein low?" },
  { name: "/data workouts", syntax: "/data workouts [days]", description: "Workouts, sets per muscle group and PRs", category: "data", icon: Dumbbell, defaultDays: 14, dayOptions: [7, 14, 30], samplePrompt: "Review my training frequency and volume." },
  { name: "/data bodycomp", syntax: "/data bodycomp [days]", description: "Weigh-ins and weight trend", category: "data", icon: Scale, defaultDays: 60, dayOptions: [30, 60, 90], samplePrompt: "How fast am I losing weight?" },
  { name: "/data all", syntax: "/data all [days]", description: "Nutrition, training, weight, steps and water", category: "data", icon: Database, defaultDays: 30, dayOptions: [14, 30, 60], samplePrompt: "Give me a full review." },
  { name: "/summary", syntax: "/summary", description: "Today's calories, remaining macros, water and steps", category: "data", icon: Zap },
  { name: "/plateau", syntax: "/plateau", description: "Diagnose a stall using 30 days of intake and training", category: "analysis", icon: Activity },
  { name: "/macros", syntax: "/macros [days]", description: "Protein distribution, meal timing and macro ratios", category: "analysis", icon: UtensilsCrossed, defaultDays: 14, dayOptions: [7, 14, 30] },
  { name: "/volume", syntax: "/volume [days]", description: "Weekly working sets per muscle vs hypertrophy landmarks", category: "analysis", icon: Dumbbell, defaultDays: 14, dayOptions: [7, 14, 30] },
  { name: "/prs", syntax: "/prs [days]", description: "Best sets and personal records", category: "analysis", icon: TrendingUp, defaultDays: 30, dayOptions: [14, 30, 60] },
  { name: "/recalc", syntax: "/recalc", description: "Recalculate targets from your real 30-day weight change", category: "analysis", icon: SlidersHorizontal },
  { name: "/clear", syntax: "/clear", description: "Clear this conversation", category: "utility", icon: Trash2 },
  { name: "/help", syntax: "/help", description: "Show all commands", category: "utility", icon: HelpCircle },
];

const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.txt,.csv,.json,.md";
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf", "txt", "csv", "json", "md"]);
const MAX_TEXT_FILE_BYTES = 500 * 1024;
const HISTORY_TURNS = 10;

interface PendingAttachment extends ChatAttachmentPayload {
  id: string;
  size: number;
  previewUrl?: string;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string, name: string) {
  const lower = `${type} ${name}`.toLowerCase();
  if (lower.includes("image")) return ImageIcon;
  if (lower.includes("pdf")) return FileText;
  if (lower.includes("csv")) return FileSpreadsheet;
  if (lower.includes("json") || lower.endsWith(".md")) return FileCode;
  return FileIcon;
}

export interface CoachChip {
  label: string;
  /** Sent at once (a command). */
  send?: string;
  /** Put in the message box to finish. */
  prompt?: string;
}

const CHIPS: Record<string, CoachChip[]> = {
  today: [
    { label: "Today so far", send: "/summary" },
    { label: "Log what I ate", prompt: "I had " },
    { label: "Review my week", send: "/data all 7d" },
  ],
  train: [
    { label: "Sets per muscle", send: "/volume 14d" },
    { label: "My records", send: "/prs 30d" },
    { label: "Review my training", send: "/data workouts 14d" },
  ],
  eat: [
    { label: "Log what I ate", prompt: "I had " },
    { label: "Protein and timing", send: "/macros 7d" },
    { label: "Meals this week", send: "/data meals 7d" },
  ],
  plan: [
    { label: "Today so far", send: "/summary" },
    { label: "Plan around my training", prompt: "Help me plan tomorrow around my workout: " },
    { label: "Review my week", send: "/data all 7d" },
  ],
  body: [
    { label: "Log my weight", prompt: "I weigh " },
    { label: "Weight trend", send: "/data bodycomp 30d" },
    { label: "Am I stalling?", send: "/plateau" },
    { label: "Recalculate targets", send: "/recalc" },
  ],
};

/** Suggestion chips, the screen the Coach was opened from first. */
export function chipsFor(from: string | null | undefined): CoachChip[] {
  const path = from ?? "";
  const first = path.startsWith("/workouts")
    ? "train"
    : path.startsWith("/nutrition")
      ? "eat"
      : path.startsWith("/planner") || path.startsWith("/habits")
        ? "plan"
        : path.startsWith("/body-comp")
          ? "body"
          : "today";
  const seen = new Set<string>();
  const ordered: CoachChip[] = [];
  for (const key of [first, "today", "eat", "train", "body", "plan"]) {
    for (const chip of CHIPS[key]) {
      if (seen.has(chip.label)) continue;
      seen.add(chip.label);
      ordered.push(chip);
    }
  }
  return ordered.slice(0, 6);
}

function helpText(): string {
  return [
    "### Commands",
    ...COMMAND_DEFINITIONS.map((c) => `- \`${c.syntax}\`: ${c.description}`),
    "",
    "### Tips",
    "- Tell me what you ate, drank, walked or weighed (\"had 2 eggs and toast for breakfast\") and I'll prepare entries for you to confirm. Nothing is saved until you press **Log it**.",
    "- Use **Reply** on a message to ask about it. Quoted messages and attached files are never logged.",
    "- Attach photos, PDFs or CSV/TXT/JSON files for analysis (up to 4 files, 2.5 MB in total).",
  ].join("\n");
}

/**
 * The Coach: a full-height chat (Close · Coach · New chat) with suggestion
 * chips for the screen it was opened from; slash commands keep working and
 * entries it prepares wait as Suggested cards until the user logs them.
 */
export function CoachClient({ from = null }: { from?: string | null }) {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const userId = user?._id ? String(user._id) : null;
  const timeZone = resolveTimeZone(user?.preferences?.timezone);

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<StoredQuote[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<CommandDef | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [canRetry, setCanRetry] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<ChatRequestBody | null>(null);
  const createdUrlsRef = useRef<Set<string>>(new Set());
  const committingRef = useRef(new Set<string>());

  // Load this account's saved conversation once on the client.
  useEffect(() => {
    const stored = loadHistory(userId);
    const timer = window.setTimeout(() => {
      setMessages(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    if (hydrated) saveHistory(userId, messages);
  }, [hydrated, userId, messages]);

  // Free image previews and stop a pending request when leaving the page.
  useEffect(() => {
    const urls = createdUrlsRef.current;
    const pending = abortRef;
    return () => {
      pending.current?.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Follow new messages only when the reader is already at the bottom.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed && nearBottomRef.current) feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const today = localDateString(new Date(), timeZone);
  const query = input.trim().toLowerCase();
  const filteredCommands = input.startsWith("/")
    ? COMMAND_DEFINITIONS.filter((c) => c.name.includes(query) || c.description.toLowerCase().includes(query.slice(1)))
    : COMMAND_DEFINITIONS;

  const scrollToBottomSoon = () => {
    nearBottomRef.current = true;
  };

  const appendMessages = useCallback((...items: CoachMessage[]) => {
    setMessages((prev) => [...prev, ...items]);
  }, []);

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setQuotes([]);
    setAttachments([]);
    setActiveCommand(null);
    setConfirmClear(false);
    lastRequestRef.current = null;
    setCanRetry(false);
  };

  const runRequest = async (body: ChatRequestBody) => {
    const controller = new AbortController();
    abortRef.current = controller;
    lastRequestRef.current = body;
    setCanRetry(false);
    setIsLoading(true);
    scrollToBottomSoon();

    let errorText: string | null = null;
    try {
      const payload = JSON.stringify(body);
      if (payload.length > CHAT_LIMITS.maxBodyBytes) {
        errorText = "This message and its attachments are too large. Remove a file and try again.";
      } else {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: controller.signal,
        });
        const result = await readApiResponse<ChatResponseBody & Record<string, unknown>>(res);
        if (controller.signal.aborted) return;
        if (result.ok) {
          const data = result.data;
          const proposals: ProposalState[] = (data.proposals || []).map((proposal) => ({
            proposal,
            commitId: newId(),
            status: "pending",
          }));
          appendMessages({
            id: newId(),
            sender: "assistant",
            text: data.reply,
            createdAt: new Date().toISOString(),
            modelUsed: data.modelUsed,
            commandName: data.commandDetected,
            dataContext: data.dataContext,
            proposals: proposals.length ? proposals : undefined,
            notice: data.notice || null,
          });
          lastRequestRef.current = null;
        } else {
          errorText = result.error;
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        errorText = "Stopped. The reply was cancelled.";
      } else {
        errorText = "Could not reach the coach. Check your connection and try again.";
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }

    if (errorText) {
      setCanRetry(lastRequestRef.current !== null);
      appendMessages({ id: newId(), sender: "assistant", text: errorText, createdAt: new Date().toISOString(), isError: true });
    }
  };

  const sendMessage = async (override?: { text: string; command?: CommandDef }) => {
    if (isLoading || isReadingFiles) return;
    const command = override?.command ?? activeCommand;
    let text = (override?.text ?? input).trim();
    if (command && !override) {
      const days = command.dayOptions && selectedDays ? ` ${selectedDays}d` : "";
      text = `${command.name}${days}${text ? ` ${text}` : ""}`;
    }
    if (!text && attachments.length === 0) return;

    if (text === "/clear") {
      setInput("");
      setActiveCommand(null);
      setConfirmClear(true);
      return;
    }
    if (text === "/help") {
      setInput("");
      setActiveCommand(null);
      const now = new Date().toISOString();
      appendMessages(
        { id: newId(), sender: "user", text: "/help", createdAt: now },
        { id: newId(), sender: "assistant", text: helpText(), createdAt: now }
      );
      scrollToBottomSoon();
      return;
    }

    const history = recentTurns(messages, HISTORY_TURNS, CHAT_LIMITS.historyChars);
    const sentAttachments: StoredAttachment[] = attachments.map((a) => ({ name: a.name, type: a.type, size: a.size }));
    const sentPreviews: Record<string, string> = {};
    attachments.forEach((a) => {
      if (a.previewUrl) sentPreviews[`${a.name}:${a.size}`] = a.previewUrl;
    });
    if (Object.keys(sentPreviews).length) setPreviewUrls((prev) => ({ ...prev, ...sentPreviews }));

    const body: ChatRequestBody = {
      message: text.slice(0, CHAT_LIMITS.messageChars),
      history,
      quotes: quotes.map((q) => ({ sender: q.sender, text: q.text.slice(0, CHAT_LIMITS.quoteChars) })),
      attachments: attachments.map(({ name, type, base64 }) => ({ name, type, base64 })),
    };

    appendMessages({
      id: newId(),
      sender: "user",
      text: text || "Sent attachments",
      createdAt: new Date().toISOString(),
      commandName: command?.name ?? null,
      quotes: quotes.length ? quotes : undefined,
      attachments: sentAttachments.length ? sentAttachments : undefined,
    });
    setInput("");
    setActiveCommand(null);
    setSelectedDays(null);
    setShowPalette(false);
    setQuotes([]);
    setAttachments([]);
    setUploadErrors([]);
    await runRequest(body);
  };

  const retryLast = () => {
    const last = lastRequestRef.current;
    if (!last || isLoading) return;
    void runRequest(last);
  };

  const stop = () => abortRef.current?.abort();

  const selectCommand = (command: CommandDef) => {
    setShowPalette(false);
    if (!command.dayOptions) {
      void sendMessage({ text: command.name, command });
      return;
    }
    setActiveCommand(command);
    setSelectedDays(command.defaultDays ?? null);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPalette && filteredCommands.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
        event.preventDefault();
        selectCommand(filteredCommands[Math.min(paletteIndex, filteredCommands.length - 1)]);
        return;
      }
      if (event.key === "Escape") {
        setShowPalette(false);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const toggleQuote = (message: CoachMessage) => {
    setQuotes((prev) => {
      if (prev.some((q) => q.id === message.id)) return prev.filter((q) => q.id !== message.id);
      if (prev.length >= CHAT_LIMITS.quotes) {
        toast(`You can quote up to ${CHAT_LIMITS.quotes} messages.`, "warning");
        return prev;
      }
      return [...prev, { id: message.id, sender: message.sender, text: message.text.slice(0, CHAT_LIMITS.quoteChars) }];
    });
    inputRef.current?.focus();
  };

  const trackUrl = (url: string) => {
    createdUrlsRef.current.add(url);
    return url;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const errors: string[] = [];
    const added: PendingAttachment[] = [];
    let total = attachments.reduce((sum, a) => sum + a.size, 0);
    let count = attachments.length;
    setIsReadingFiles(true);

    for (const file of files) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (count >= CHAT_LIMITS.attachments) {
        errors.push(`Only ${CHAT_LIMITS.attachments} files can be attached to one message.`);
        break;
      }
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        errors.push(`${file.name}: this file type is not supported.`);
        continue;
      }
      const isText = ["txt", "csv", "json", "md"].includes(ext);
      if (isText && file.size > MAX_TEXT_FILE_BYTES) {
        errors.push(`${file.name}: text files can be up to 500 KB.`);
        continue;
      }
      try {
        const prepared = await prepareUpload(file);
        if (total + prepared.size > CHAT_LIMITS.totalAttachmentBytes) {
          errors.push(`${file.name}: attachments are limited to 2.5 MB in total.`);
          continue;
        }
        const resized = prepared.type === "image/jpeg" && !/\.jpe?g$/i.test(file.name);
        const name = resized ? `${file.name.replace(/\.[^.]+$/, "")}.jpg` : file.name;
        const isImage = prepared.type.startsWith("image/") && !/\.(heic|heif)$/i.test(name);
        added.push({
          id: newId(),
          name,
          type: prepared.type,
          size: prepared.size,
          base64: prepared.base64,
          previewUrl: isImage ? trackUrl(URL.createObjectURL(file)) : undefined,
        });
        total += prepared.size;
        count += 1;
      } catch {
        errors.push(`${file.name}: the file could not be read.`);
      }
    }

    setIsReadingFiles(false);
    setAttachments((prev) => [...prev, ...added]);
    setUploadErrors(errors);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        createdUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const updateProposal = (messageId: string, index: number, patch: Partial<ProposalState>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.proposals
          ? { ...m, proposals: m.proposals.map((p, i) => (i === index ? { ...p, ...patch } : p)) }
          : m
      )
    );
  };

  const confirmProposal = async (messageId: string, index: number, state: ProposalState) => {
    if (committingRef.current.has(state.commitId)) return;
    committingRef.current.add(state.commitId);
    updateProposal(messageId, index, { status: "saving", error: undefined });
    try {
      const res = await fetch("/api/assistant/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitId: state.commitId, proposal: state.proposal }),
      });
      const result = await readApiResponse<CommitResponseBody & Record<string, unknown>>(res);
      if (result.ok) {
        updateProposal(messageId, index, { status: "saved" });
        toast(`Logged: ${result.data.summary}`, "success");
      } else {
        updateProposal(messageId, index, { status: "error", error: result.error });
      }
    } catch {
      updateProposal(messageId, index, {
        status: "error",
        error: "Could not reach the server. Nothing new was saved; you can try again safely.",
      });
    } finally {
      committingRef.current.delete(state.commitId);
    }
  };

  const changeProposal = (messageId: string, index: number, proposal: LogProposal) =>
    // An edited entry gets a new commit id so it is not mistaken for an earlier attempt.
    updateProposal(messageId, index, { proposal, commitId: newId(), status: "pending", error: undefined });

  const canSend = !isLoading && !isReadingFiles && (input.trim().length > 0 || !!activeCommand || attachments.length > 0);
  const lastMessage = messages[messages.length - 1];
  const chips = chipsFor(from);
  const showChips = !activeCommand && !isLoading && input.trim() === "" && quotes.length === 0;

  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push(from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard");
  };

  const applyChip = (chip: CoachChip) => {
    if (chip.send) {
      const command = COMMAND_DEFINITIONS.find((item) => chip.send?.startsWith(item.name));
      void sendMessage({ text: chip.send, command });
      return;
    }
    setInput(chip.prompt ?? "");
    window.setTimeout(() => {
      const field = inputRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }, 0);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className="fixed inset-0 z-20 flex justify-center bg-canvas md:start-(--rail-width)"
    >
      <div className={cn("relative flex h-full w-full max-w-[680px] flex-col", isDragging && "outline outline-1 outline-accent")}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <header className="shrink-0 border-b border-line px-1.5 pt-[env(safe-area-inset-top)]">
          <div className="flex h-[52px] items-center justify-between gap-2">
            <IconButton label="Close Coach" icon={<X className="h-5 w-5" />} onClick={close} />
            <h1 className="text-[15px] font-semibold text-ink">Coach</h1>
            <Button variant="ghost" size="sm" disabled={messages.length === 0} onClick={() => setConfirmClear(true)}>
              New chat
            </Button>
          </div>
        </header>

        <div
          ref={feedRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation with the Coach"
          className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {hydrated && messages.length === 0 && (
            <div className="mx-auto mt-4 max-w-md space-y-2 text-center">
              <p className="text-section font-semibold text-ink">Ask the Coach</p>
              <p className="text-sm leading-6 text-ink-2">
                Ask about training or nutrition, run a command like <code className="rounded bg-elevated px-1 font-mono text-[13px] text-ink">/summary</code>, or tell
                me what you ate. Entries I prepare wait for you to log them.
              </p>
              <p className="text-xs text-ink-3">This conversation stays on this device until you start a new chat.</p>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.sender === "user";
            const isQuoted = quotes.some((q) => q.id === message.id);
            return (
              <article key={message.id} aria-label={isUser ? "You" : "Coach"} className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
                {message.dataContext && (
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-line bg-elevated px-2 text-xs text-ink-2">
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    {message.dataContext.badgeLabel}
                    <span className="font-mono tabular-nums text-ink-3">~{message.dataContext.tokensEstimated.toLocaleString("en-US")} tokens</span>
                  </span>
                )}

                {message.quotes && message.quotes.length > 0 && (
                  <div className="max-w-[88%] space-y-1">
                    {message.quotes.map((quote) => (
                      <div key={quote.id} className="rounded-control border-s-2 border-line-strong bg-surface px-3 py-1.5 text-xs text-ink-2">
                        <span className="flex items-center gap-1.5 font-medium text-ink-3">
                          <Reply className="h-3 w-3" aria-hidden="true" />
                          {quote.sender === "user" ? "You" : "Coach"}
                        </span>
                        <p className="line-clamp-2 text-start">{quote.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {message.attachments && message.attachments.length > 0 && (
                  <ul className="flex max-w-[88%] flex-wrap justify-end gap-2" aria-label="Attachments">
                    {message.attachments.map((att, index) => {
                      const url = previewUrls[`${att.name}:${att.size}`];
                      const Icon = fileIcon(att.type, att.name);
                      return (
                        <li key={`${att.name}-${index}`}>
                          {url ? (
                            <button type="button" onClick={() => setPreviewUrl(url)} aria-label={`View ${att.name}`} className="block overflow-hidden rounded-control border border-line">
                              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                              <img src={url} alt={att.name} className="h-20 w-28 object-cover" />
                            </button>
                          ) : (
                            <span className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-xs text-ink-2">
                              <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="block max-w-40 truncate font-medium text-ink">{att.name}</span>
                                <span className="block font-mono tabular-nums text-ink-3">{formatFileSize(att.size)}</span>
                              </span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div
                  className={cn(
                    "text-[15px] leading-6",
                    isUser
                      ? "max-w-[88%] rounded-card rounded-ee-chip border border-line bg-elevated px-3.5 py-2.5 text-ink"
                      : message.isError
                        ? "max-w-[95%] rounded-control border border-line bg-surface px-3.5 py-2.5 text-danger"
                        : "w-full text-ink"
                  )}
                >
                  {isUser || message.isError ? (
                    <p className="whitespace-pre-wrap break-words text-start">
                      {message.isError && <AlertCircle className="-mt-0.5 me-1.5 inline h-4 w-4" aria-hidden="true" />}
                      {message.text}
                    </p>
                  ) : (
                    <Markdown text={message.text} className="space-y-2 text-[15px] leading-6 text-start text-ink" />
                  )}
                </div>

                {message.isError && message === lastMessage && canRetry && !isLoading && (
                  <Button variant="secondary" size="sm" onClick={retryLast} startContent={<RotateCw className="h-3.5 w-3.5" />}>
                    Try again
                  </Button>
                )}

                {message.notice && (
                  <p className="flex items-start gap-1.5 text-xs text-ink-3">
                    <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {message.notice}
                  </p>
                )}

                {message.proposals && message.proposals.length > 0 && (
                  <section aria-label="Entries to log" className="w-full space-y-2">
                    {message.proposals.map((state, index) => (
                      <ProposalCard
                        key={state.proposal.id}
                        state={state}
                        today={today}
                        onChange={(proposal) => changeProposal(message.id, index, proposal)}
                        onConfirm={() => void confirmProposal(message.id, index, state)}
                        onDismiss={() => updateProposal(message.id, index, { status: "dismissed" })}
                      />
                    ))}
                  </section>
                )}

                <div className="flex items-center gap-1 text-xs text-ink-3">
                  <time dateTime={message.createdAt} className="font-mono tabular-nums">
                    {formatTimeInZone(message.createdAt, timeZone)}
                  </time>
                  {!message.isError && (
                    <button
                      type="button"
                      onClick={() => toggleQuote(message)}
                      aria-pressed={isQuoted}
                      aria-label={isQuoted ? "Remove quote" : "Quote this message in your reply"}
                      className={cn(
                        "flex min-h-9 items-center gap-1 rounded-chip px-2 text-xs font-medium transition-colors cursor-pointer",
                        isQuoted ? "text-ink" : "hover:bg-elevated hover:text-ink"
                      )}
                    >
                      <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                      {isQuoted ? "Quoted" : "Reply"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {isLoading && (
            <div role="status" className="flex items-center gap-3 text-sm text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>The Coach is thinking…</span>
              <Button variant="secondary" size="sm" onClick={stop} startContent={<Square className="h-3 w-3" />}>
                Stop
              </Button>
            </div>
          )}
        </div>

        {showPalette && filteredCommands.length > 0 && (
          <div role="listbox" aria-label="Commands" className="glass-float absolute inset-x-3 bottom-28 z-40 max-h-72 space-y-0.5 overflow-y-auto rounded-card p-1.5">
            {filteredCommands.map((command, index) => {
              const Icon = command.icon;
              const isSelected = index === paletteIndex;
              return (
                <button
                  key={command.name}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCommand(command)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-chip px-3 py-1.5 text-start transition-colors focus:outline-none cursor-pointer",
                    isSelected ? "bg-elevated" : "hover:bg-elevated/60"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-medium text-ink">{command.name}</span>
                    <span className="block truncate text-xs text-ink-3">{command.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="shrink-0 border-t border-line">
          {activeCommand && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-7 items-center rounded-chip bg-ink px-2 font-mono text-xs font-medium text-ink-inverse">{activeCommand.name}</span>
                {activeCommand.dayOptions && (
                  <div role="radiogroup" aria-label="Number of days" className="flex items-center gap-1">
                    {activeCommand.dayOptions.map((days) => (
                      <button
                        key={days}
                        type="button"
                        role="radio"
                        aria-checked={selectedDays === days}
                        onClick={() => setSelectedDays(days)}
                        className={cn(
                          "min-h-9 rounded-chip border px-2.5 font-mono text-xs tabular-nums transition-colors cursor-pointer",
                          selectedDays === days ? "border-ink bg-ink text-ink-inverse" : "border-line bg-surface text-ink-2 hover:text-ink"
                        )}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveCommand(null);
                  setSelectedDays(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {quotes.length > 0 && (
            <div className="space-y-1 px-3 py-2">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span className="flex items-center gap-1.5 font-medium text-ink-2">
                  <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                  Replying to {quotes.length} message{quotes.length > 1 ? "s" : ""}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setQuotes([])}>
                  Clear
                </Button>
              </div>
              <ul className="flex items-center gap-2 overflow-x-auto pb-1">
                {quotes.map((quote) => (
                  <li key={quote.id} className="flex max-w-xs shrink-0 items-center gap-1 rounded-chip border border-line bg-surface ps-2.5 text-xs text-ink-2">
                    <span className="max-w-48 truncate">{quote.text}</span>
                    <button
                      type="button"
                      onClick={() => setQuotes((prev) => prev.filter((q) => q.id !== quote.id))}
                      className="grid h-9 w-9 place-items-center text-ink-3 hover:text-ink cursor-pointer"
                      aria-label="Remove quoted message"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(attachments.length > 0 || isReadingFiles) && (
            <ul className="flex items-center gap-2 overflow-x-auto px-3 py-2" aria-label="Files to send">
              {attachments.map((att) => {
                const Icon = fileIcon(att.type, att.name);
                return (
                  <li key={att.id} className="flex shrink-0 items-center gap-2 rounded-control border border-line bg-surface ps-2 text-xs text-ink-2">
                    {att.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                      <img src={att.previewUrl} alt="" className="h-8 w-8 rounded-chip object-cover" />
                    ) : (
                      <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                    )}
                    <span className="min-w-0 max-w-32">
                      <span className="block truncate font-medium text-ink">{att.name}</span>
                      <span className="block font-mono tabular-nums text-ink-3">{formatFileSize(att.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="grid h-10 w-10 place-items-center text-ink-3 hover:text-ink cursor-pointer"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
              {isReadingFiles && (
                <li role="status" className="flex items-center gap-2 text-xs text-ink-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Preparing files…
                </li>
              )}
            </ul>
          )}

          {uploadErrors.length > 0 && (
            <div role="alert" className="flex items-start justify-between gap-2 px-3 py-2 text-xs text-danger">
              <ul className="space-y-0.5">
                {uploadErrors.map((error, index) => (
                  <li key={index} className="flex items-start gap-1.5">
                    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {error}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setUploadErrors([])} className="grid h-9 w-9 place-items-center text-ink-3 hover:text-ink cursor-pointer" aria-label="Dismiss file errors">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {showChips && (
            <div role="group" aria-label="Suggestions" className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-2.5">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => applyChip(chip)}
                  className="inline-flex min-h-9 shrink-0 items-center rounded-chip border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-end gap-2 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <IconButton
              label="Attach photos or files"
              icon={<Paperclip className="h-5 w-5" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || attachments.length >= CHAT_LIMITS.attachments}
            />
            <label htmlFor="coach-input" className="sr-only">
              Message the Coach
            </label>
            <Textarea
              id="coach-input"
              ref={inputRef}
              value={input}
              rows={Math.min(6, Math.max(1, input.split("\n").length))}
              maxLength={CHAT_LIMITS.messageChars}
              onChange={(e) => {
                const value = e.target.value;
                setInput(value);
                const opensPalette = value.startsWith("/") && !value.includes(" ") && !activeCommand;
                setShowPalette(opensPalette);
                if (opensPalette) setPaletteIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                activeCommand
                  ? activeCommand.samplePrompt || "Add a question (optional) and press Enter"
                  : quotes.length
                    ? "Ask about the quoted messages…"
                    : "Ask anything, or type /"
              }
              containerClassName="min-w-0 flex-1"
              className="max-h-40 min-h-11 resize-none text-base leading-6"
            />
            {isLoading ? (
              <Button variant="secondary" onClick={stop} aria-label="Stop the reply" className="w-11 px-0">
                <Square className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" disabled={!canSend} aria-label="Send message" className="w-11 px-0">
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </form>
        </div>
      </div>

      <Sheet isOpen={Boolean(previewUrl)} onClose={() => setPreviewUrl(null)} title="Attachment" size="lg">
        {previewUrl && (
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={previewUrl} alt="Attachment preview" className="max-h-[70vh] rounded-control object-contain" />
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        isOpen={confirmClear}
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearChat}
        title="Start a new chat?"
        message="This conversation and any entries you have not logged are removed from this device. Logged entries stay in your diary."
        confirmLabel="New chat"
        destructive
      />
    </div>
  );
}

export default CoachClient;
