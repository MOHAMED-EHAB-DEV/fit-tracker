"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
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
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
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

export function CoachClient() {
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
      className={cn(
        "flex flex-col h-[calc(100dvh-8rem)] max-w-4xl mx-auto rounded-3xl bg-zinc-900/80 border border-zinc-800/80 overflow-hidden shadow-2xl relative",
        isDragging && "ring-2 ring-emerald-500"
      )}
    >
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

      {/* Header */}
      <header className="p-3 sm:p-4 border-b border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-white">AI Coach</h1>
            <p className="text-xs text-zinc-400 truncate">
              Ask anything, type <span className="font-mono text-emerald-400">/</span> for commands, or tell me what you ate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={messages.length === 0}
            aria-label="Clear chat"
            className="flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-xs text-zinc-300 border border-zinc-700/70 hover:bg-zinc-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Clear chat</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={feedRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with the AI Coach"
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
      >
        {hydrated && messages.length === 0 && (
          <div className="max-w-lg mx-auto mt-6 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-sm text-zinc-300 space-y-2">
            <p className="font-semibold text-white">Hi! I&apos;m your AI Coach.</p>
            <p>Ask about training or nutrition, run a command like <code className="font-mono text-emerald-400">/summary</code>, or tell me what you ate. I&apos;ll prepare entries for you to check, and nothing is saved until you press Log it.</p>
            <p className="text-xs text-zinc-400">This conversation is kept on this device until you clear it.</p>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.sender === "user";
          const isQuoted = quotes.some((q) => q.id === message.id);
          return (
            <article
              key={message.id}
              aria-label={isUser ? "You" : "AI Coach"}
              className={cn("flex gap-2 sm:gap-3 max-w-[95%] sm:max-w-[88%]", isUser ? "ms-auto flex-row-reverse" : "me-auto")}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  isUser ? "bg-zinc-800 text-zinc-200 border border-zinc-700" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                )}
                aria-hidden="true"
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="space-y-2 flex-1 min-w-0">
                {message.dataContext && (
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium w-fit">
                    <Database className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{message.dataContext.badgeLabel}</span>
                    <span className="text-zinc-400 tabular-nums">(~{message.dataContext.tokensEstimated.toLocaleString("en-US")} tokens)</span>
                  </div>
                )}

                {message.quotes && message.quotes.length > 0 && (
                  <div className="space-y-1.5">
                    {message.quotes.map((quote) => (
                      <div key={quote.id} className="px-3 py-2 rounded-xl text-xs border-s-2 border-emerald-500 bg-zinc-950/60 text-zinc-300">
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                          <Reply className="w-3 h-3" aria-hidden="true" />
                          {quote.sender === "user" ? "You" : "AI Coach"}
                        </span>
                        <p className="line-clamp-2 text-start">{quote.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {message.attachments && message.attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Attachments">
                    {message.attachments.map((att, index) => {
                      const url = previewUrls[`${att.name}:${att.size}`];
                      const Icon = fileIcon(att.type, att.name);
                      return (
                        <li key={`${att.name}-${index}`}>
                          {url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewUrl(url)}
                              aria-label={`View ${att.name}`}
                              className="block rounded-xl overflow-hidden border border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                              <img src={url} alt={att.name} className="w-28 h-20 object-cover" />
                            </button>
                          ) : (
                            <span className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-zinc-300 text-xs">
                              <Icon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="block font-semibold text-white truncate max-w-40">{att.name}</span>
                                <span className="block text-zinc-400">{formatFileSize(att.size)}</span>
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
                    "p-3 sm:p-4 rounded-3xl text-sm leading-relaxed",
                    isUser
                      ? "bg-emerald-500 text-zinc-950 font-medium rounded-te-none"
                      : message.isError
                        ? "bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-ts-none"
                        : "bg-zinc-950/80 border border-zinc-800/80 text-zinc-200 rounded-ts-none"
                  )}
                >
                  {isUser || message.isError ? (
                    <p className="whitespace-pre-wrap break-words text-start">
                      {message.isError && <AlertCircle className="inline w-4 h-4 me-1.5 -mt-0.5" aria-hidden="true" />}
                      {message.text}
                    </p>
                  ) : (
                    <Markdown text={message.text} />
                  )}
                </div>

                {message.isError && message === lastMessage && canRetry && !isLoading && (
                  <Button variant="bordered" size="md" onClick={retryLast} startContent={<RotateCw className="w-4 h-4" />}>
                    Try again
                  </Button>
                )}

                {message.notice && (
                  <p className="flex items-start gap-1.5 text-xs text-zinc-400 px-1">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                    {message.notice}
                  </p>
                )}

                {message.proposals && message.proposals.length > 0 && (
                  <section aria-label="Entries to confirm" className="space-y-2">
                    <p className="text-xs text-zinc-400 px-1">Check these entries. Nothing is saved until you press Log it.</p>
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

                <div className={cn("flex items-center gap-1 px-1 text-xs text-zinc-400", isUser && "justify-end")}>
                  <time dateTime={message.createdAt}>{formatTimeInZone(message.createdAt, timeZone)}</time>
                  {!message.isError && (
                    <button
                      type="button"
                      onClick={() => toggleQuote(message)}
                      aria-pressed={isQuoted}
                      aria-label={isQuoted ? "Remove quote" : "Quote this message in your reply"}
                      className={cn(
                        "flex items-center gap-1 px-2.5 min-h-11 rounded-lg text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                        isQuoted ? "text-emerald-400" : "text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
                      )}
                    >
                      <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                      {isQuoted ? "Quoted" : "Reply"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {isLoading && (
          <div role="status" className="flex items-center gap-3 text-zinc-300 text-sm py-3 px-4 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" aria-hidden="true" />
            <span>The coach is thinking...</span>
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1.5 px-3 min-h-11 rounded-xl border border-zinc-700 text-zinc-200 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" />
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Command palette */}
      {showPalette && filteredCommands.length > 0 && (
        <div
          role="listbox"
          aria-label="Commands"
          className="absolute bottom-24 inset-s-3 inset-e-3 max-h-72 overflow-y-auto rounded-2xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md p-2 z-40 space-y-1"
        >
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
                  "w-full text-start px-3 py-2 min-h-11 rounded-xl flex items-center gap-3 focus:outline-none",
                  isSelected ? "bg-emerald-500/20 text-white border border-emerald-500/40" : "hover:bg-zinc-900 text-zinc-300"
                )}
              >
                <Icon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold text-sm text-white">{command.name}</span>
                  <span className="block text-xs text-zinc-400 truncate">{command.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active command options */}
      {activeCommand && (
        <div className="px-3 sm:px-4 py-2 bg-zinc-950 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-zinc-950 font-bold">{activeCommand.name}</span>
            {activeCommand.dayOptions && (
              <div role="radiogroup" aria-label="Number of days" className="flex items-center gap-1.5">
                {activeCommand.dayOptions.map((days) => (
                  <button
                    key={days}
                    type="button"
                    role="radio"
                    aria-checked={selectedDays === days}
                    onClick={() => setSelectedDays(days)}
                    className={cn(
                      "px-3 min-h-11 rounded-lg font-semibold text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                      selectedDays === days ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-zinc-900 text-zinc-300 border border-zinc-800"
                    )}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveCommand(null);
              setSelectedDays(null);
            }}
            className="px-3 min-h-11 text-zinc-300 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Cancel command
          </button>
        </div>
      )}

      {/* Quotes tray */}
      {quotes.length > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-zinc-950/90 border-t border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Reply className="w-3.5 h-3.5" aria-hidden="true" />
              Replying to {quotes.length} message{quotes.length > 1 ? "s" : ""}
            </span>
            <button type="button" onClick={() => setQuotes([])} className="px-2 min-h-11 text-zinc-300 hover:text-white rounded-lg">
              Clear quotes
            </button>
          </div>
          <ul className="flex items-center gap-2 overflow-x-auto pb-1">
            {quotes.map((quote) => (
              <li key={quote.id} className="flex items-center gap-2 ps-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 shrink-0 max-w-xs">
                <span className="truncate max-w-48">{quote.text}</span>
                <button
                  type="button"
                  onClick={() => setQuotes((prev) => prev.filter((q) => q.id !== quote.id))}
                  className="min-w-11 min-h-11 flex items-center justify-center text-zinc-400 hover:text-rose-400 rounded-xl"
                  aria-label="Remove quoted message"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attachments tray */}
      {(attachments.length > 0 || isReadingFiles) && (
        <ul className="px-3 sm:px-4 py-2 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto" aria-label="Files to send">
          {attachments.map((att) => {
            const Icon = fileIcon(att.type, att.name);
            return (
              <li key={att.id} className="flex items-center gap-2 ps-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 shrink-0">
                {att.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={att.previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <Icon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 max-w-32">
                  <span className="block text-xs font-semibold text-white truncate">{att.name}</span>
                  <span className="block text-xs text-zinc-400">{formatFileSize(att.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="min-w-11 min-h-11 flex items-center justify-center text-zinc-400 hover:text-rose-400 rounded-xl"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {isReadingFiles && (
            <li role="status" className="flex items-center gap-2 text-xs text-zinc-300">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" aria-hidden="true" />
              Preparing files...
            </li>
          )}
        </ul>
      )}

      {uploadErrors.length > 0 && (
        <div role="alert" className="px-3 sm:px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-rose-300 text-xs flex items-start justify-between gap-2">
          <ul className="space-y-0.5">
            {uploadErrors.map((error, index) => (
              <li key={index} className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                {error}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setUploadErrors([])}
            className="min-w-11 min-h-11 flex items-center justify-center text-rose-300 hover:text-rose-100 rounded-xl"
            aria-label="Dismiss file errors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        className="p-2 sm:p-3 border-t border-zinc-800/80 bg-zinc-950 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || attachments.length >= CHAT_LIMITS.attachments}
          aria-label="Attach photos or files"
          className="min-w-11 min-h-11 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-emerald-400 flex items-center justify-center disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Paperclip className="w-4 h-4" aria-hidden="true" />
        </button>

        <label htmlFor="coach-input" className="sr-only">
          Message the AI Coach
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
                ? "Ask about the quoted messages..."
                : "Ask anything, or type / for commands (Shift+Enter for a new line)"
          }
          containerClassName="flex-1 min-w-0"
          className="resize-none px-4 min-h-11 max-h-40 rounded-2xl leading-5"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop the reply"
            className="min-w-11 min-h-11 rounded-2xl bg-zinc-800 border border-zinc-600 text-zinc-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Square className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="min-w-11 min-h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-50 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </form>

      <Modal isOpen={Boolean(previewUrl)} onClose={() => setPreviewUrl(null)} title="Attachment" size="lg">
        {previewUrl && (
          <div className="flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={previewUrl} alt="Attachment preview" className="max-h-[70vh] rounded-xl object-contain" />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear this chat?"
        description="The conversation and any entries you have not logged are removed from this device. Logged entries stay in your diary."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="ghost" size="md" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={clearChat}>
              Clear chat
            </Button>
          </div>
        }
      >
        <p className="text-sm text-zinc-300">This cannot be undone.</p>
      </Modal>
    </div>
  );
}

export default CoachClient;
