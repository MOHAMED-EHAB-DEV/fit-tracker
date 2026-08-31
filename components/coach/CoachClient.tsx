"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Check,
  Droplets,
  UtensilsCrossed,
  Footprints,
  ChevronDown,
  Database,
  Dumbbell,
  Scale,
  TrendingUp,
  Activity,
  Zap,
  HelpCircle,
  Trash2,
  SlidersHorizontal,
  Cpu,
  CornerDownLeft,
  Paperclip,
  Reply,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Image as ImageIcon,
  AlertCircle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DataContextSummary,
  GeminiModelChoice,
  ReferencedMessage,
  CoachAttachment,
} from "@/types/gemini";
import { Modal } from "@/components/ui/Modal";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  commandName?: string;
  modelUsed?: string;
  dataContext?: DataContextSummary | null;
  logItems?: any[];
  timestamp: string;
  referencedMessages?: ReferencedMessage[];
  attachments?: CoachAttachment[];
}

export interface CommandDef {
  name: string;
  syntax: string;
  description: string;
  category: "data" | "analysis" | "utility";
  icon: any;
  defaultDays?: number;
  dayOptions?: number[];
  samplePrompt?: string;
}

export const COMMAND_DEFINITIONS: CommandDef[] = [
  {
    name: "/data meals",
    syntax: "/data:meals [days=30]",
    description: "Compress & inject meal logs, macro averages, and calorie adherence",
    category: "data",
    icon: UtensilsCrossed,
    defaultDays: 30,
    dayOptions: [7, 14, 30, 60],
    samplePrompt: "Analyze my macro adherence and highlight days where protein was low.",
  },
  {
    name: "/data workouts",
    syntax: "/data:workouts [days=14]",
    description: "Compress & inject workout logs, volume per muscle group, and PRs",
    category: "data",
    icon: Dumbbell,
    defaultDays: 14,
    dayOptions: [7, 14, 30],
    samplePrompt: "Review my training frequency and volume progression.",
  },
  {
    name: "/data bodycomp",
    syntax: "/data:bodycomp [days=60]",
    description: "Compress & inject weigh-ins, body fat % trends, and physique notes",
    category: "data",
    icon: Scale,
    defaultDays: 60,
    dayOptions: [30, 60, 90],
    samplePrompt: "Evaluate my weight loss slope and body composition changes.",
  },
  {
    name: "/data progress",
    syntax: "/data:progress [days=30]",
    description: "Inject holistic progress: weight delta, calorie balance, and 1RM records",
    category: "data",
    icon: TrendingUp,
    defaultDays: 30,
    dayOptions: [14, 30, 60],
    samplePrompt: "Give me an overview of my calorie deficit vs actual weight loss.",
  },
  {
    name: "/data all",
    syntax: "/data:all [days=30]",
    description: "Full 360° fitness review across nutrition, training, steps & hydration",
    category: "data",
    icon: Database,
    defaultDays: 30,
    dayOptions: [14, 30],
    samplePrompt: "Provide a comprehensive coach review of all my metrics.",
  },
  {
    name: "/summary",
    syntax: "/summary",
    description: "Live snapshot of today's calories, remaining macros, water & steps",
    category: "data",
    icon: Zap,
    defaultDays: 1,
    samplePrompt: "What are my remaining calories and macros for today?",
  },
  {
    name: "/plateau",
    syntax: "/plateau",
    description: "Diagnose fat loss or strength plateaus using 30-day intake & volume",
    category: "analysis",
    icon: Activity,
    defaultDays: 30,
    samplePrompt: "Why has my progress stalled and what adjustments should I make?",
  },
  {
    name: "/macros",
    syntax: "/macros [days=14]",
    description: "Deep dive into protein distribution, meal timing, and macro ratios",
    category: "analysis",
    icon: UtensilsCrossed,
    defaultDays: 14,
    dayOptions: [7, 14, 30],
    samplePrompt: "Check if my protein distribution across meals is optimal.",
  },
  {
    name: "/volume",
    syntax: "/volume [days=14]",
    description: "Calculate weekly sets per muscle group vs hypertrophy landmarks",
    category: "analysis",
    icon: Dumbbell,
    defaultDays: 14,
    dayOptions: [7, 14, 30],
    samplePrompt: "Are my chest and back sets within optimal hypertrophy volume?",
  },
  {
    name: "/prs",
    syntax: "/prs [days=30]",
    description: "Track 1RM strength curves & personal records on compound lifts",
    category: "analysis",
    icon: TrendingUp,
    defaultDays: 30,
    dayOptions: [14, 30, 60],
    samplePrompt: "Analyze my 1RM progression across bench and squat.",
  },
  {
    name: "/recalc",
    syntax: "/recalc",
    description: "Recalculate calorie & protein targets based on actual 30d weight change",
    category: "analysis",
    icon: SlidersHorizontal,
    defaultDays: 30,
    samplePrompt: "Recalculate my cutting calories based on my actual rate of loss.",
  },
  {
    name: "/clear",
    syntax: "/clear",
    description: "Clear conversation history in the chat view",
    category: "utility",
    icon: Trash2,
  },
  {
    name: "/help",
    syntax: "/help",
    description: "Display full command list & prompt options cheat sheet",
    category: "utility",
    icon: HelpCircle,
  },
];

export const MODEL_OPTIONS: { id: GeminiModelChoice; label: string; tag: string; description: string }[] = [
  {
    id: "gemini-flash-lite",
    label: "Gemini Flash Lite",
    tag: "Default • Ultra-Fast",
    description: "Zero latency for rapid food/water logging and fast data summaries",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    tag: "High Intelligence",
    description: "Deep, accurate coaching analysis for multi-week trends, meals & volume",
  },
];

const ALLOWED_UPLOAD_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "pdf",
  "txt",
  "csv",
  "json",
  "md",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 5;

export function CoachClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "assistant",
      text: "👋 **Welcome to your AI Strength & Nutrition Coach!**\n\nType `/` to browse available data & analysis commands, quote past messages to ask follow-up questions, or attach meal photos and data files to analyze instantly.",
      timestamp: "Just now",
      modelUsed: "gemini-flash-lite",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<GeminiModelChoice>("gemini-flash-lite");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Quoted / Referenced Messages state
  const [referencedMessages, setReferencedMessages] = useState<ReferencedMessage[]>([]);

  // Attachments state
  const [attachments, setAttachments] = useState<CoachAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Command palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<CommandDef | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Filter commands when user types after "/"
  const filteredCommands = input.startsWith("/")
    ? COMMAND_DEFINITIONS.filter(
        (c) =>
          c.name.toLowerCase().includes(input.toLowerCase()) ||
          c.syntax.toLowerCase().includes(input.toLowerCase()) ||
          c.description.toLowerCase().includes(input.toLowerCase())
      )
    : COMMAND_DEFINITIONS;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    if (val.startsWith("/")) {
      setShowCommandPalette(true);
      setSelectedCmdIndex(0);
    } else {
      setShowCommandPalette(false);
    }
  };

  const selectCommand = (cmd: CommandDef, customDays?: number) => {
    if (cmd.name === "/clear") {
      setMessages([
        {
          id: Date.now().toString(),
          sender: "assistant",
          text: "Chat cleared! How can I assist your fitness goals today? Type `/` for commands.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          modelUsed: selectedModel,
        },
      ]);
      setInput("");
      setShowCommandPalette(false);
      setActiveCommand(null);
      setReferencedMessages([]);
      setAttachments([]);
      return;
    }

    if (cmd.name === "/help") {
      const helpText =
        `### 📋 Available AI Coach Slash Commands\n\n` +
        COMMAND_DEFINITIONS.map((c) => `• **\`${c.syntax}\`**: ${c.description}`).join("\n") +
        `\n\n💡 **Tips**:\n- Click the **Reply** icon on any message to reference multiple past points in your query.\n- Click the **Paperclip** icon to securely upload food photos, workout CSVs, and progress documents!`;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "user",
          text: "/help",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: helpText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          modelUsed: selectedModel,
        },
      ]);
      setInput("");
      setShowCommandPalette(false);
      setActiveCommand(null);
      return;
    }

    // Set active command with option pills
    setActiveCommand(cmd);
    const days = customDays || cmd.defaultDays || 30;
    setSelectedDays(days);
    setShowCommandPalette(false);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showCommandPalette && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCmdIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCmdIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCmdIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quoting / Referencing messages handlers
  const toggleQuoteMessage = (msg: ChatMessage) => {
    setReferencedMessages((prev) => {
      const exists = prev.some((m) => m.id === msg.id);
      if (exists) {
        return prev.filter((m) => m.id !== msg.id);
      }
      return [
        ...prev,
        {
          id: msg.id,
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
        },
      ];
    });
    inputRef.current?.focus();
  };

  const removeQuotedMessage = (id: string) => {
    setReferencedMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllQuotes = () => {
    setReferencedMessages([]);
  };

  // File Upload Handlers
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    const incoming = Array.from(fileList);
    if (attachments.length + incoming.length > MAX_FILES) {
      setUploadError(`You can upload a maximum of ${MAX_FILES} attachments per message.`);
      return;
    }

    let currentTotal = attachments.reduce((acc, a) => acc + a.size, 0);

    const newAttachments: CoachAttachment[] = [];

    for (const file of incoming) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();

      if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
        setUploadError(`File type '.${ext}' is not supported. Allowed: images (JPG, PNG, WebP, GIF), PDF, CSV, TXT, JSON, MD.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`File '${file.name}' exceeds the 10MB limit.`);
        return;
      }

      currentTotal += file.size;
      if (currentTotal > MAX_TOTAL_SIZE) {
        setUploadError(`Total attachment size exceeds the 25MB limit.`);
        return;
      }

      try {
        const base64Data = await readFileAsBase64(file);
        const isImage = file.type.startsWith("image/");
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          type: file.type || (ext === "csv" ? "text/csv" : "text/plain"),
          size: file.size,
          base64: base64Data,
          previewUrl: isImage ? `data:${file.type};base64,${base64Data}` : undefined,
        });
      } catch (readErr) {
        setUploadError(`Failed to process file '${file.name}'.`);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(";base64,").pop() || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeOrExt: string) => {
    const lower = mimeOrExt.toLowerCase();
    if (lower.includes("image")) return ImageIcon;
    if (lower.includes("pdf")) return FileText;
    if (lower.includes("csv") || lower.includes("spreadsheet")) return FileSpreadsheet;
    if (lower.includes("json") || lower.includes("code") || lower.includes("md")) return FileCode;
    return File;
  };

  const sendMessage = async (overrideText?: string) => {
    let finalMessage = (overrideText || input).trim();

    // If there is an active command selected
    if (activeCommand && !overrideText) {
      const daysPart = selectedDays && selectedDays > 1 ? ` ${selectedDays}d` : "";
      const promptPart = input.trim() ? ` ${input.trim()}` : "";
      finalMessage = `${activeCommand.name}${daysPart}${promptPart}`.trim();
    }

    if ((!finalMessage && attachments.length === 0) || isLoading) return;

    const currentQuotes = [...referencedMessages];
    const currentAttachments = [...attachments];

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: finalMessage || (currentAttachments.length > 0 ? "Uploaded attachments for analysis" : ""),
      commandName: activeCommand?.name,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      referencedMessages: currentQuotes.length > 0 ? currentQuotes : undefined,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveCommand(null);
    setSelectedDays(null);
    setShowCommandPalette(false);
    setReferencedMessages([]);
    setAttachments([]);
    setUploadError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          model: selectedModel,
          referencedMessages: currentQuotes.length > 0 ? currentQuotes : undefined,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to get AI response");
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.chatReply || "Done!",
        modelUsed: data.modelUsed || selectedModel,
        dataContext: data.dataContext || null,
        logItems: data.logItems || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: `⚠️ **Error**: ${err.message || "Could not process request. Please try again."}`,
        modelUsed: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormattedText = (content: string) => {
    const lines = content.split("\n");
    return (
      <div className="space-y-1.5 text-sm leading-relaxed text-start">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          if (trimmed.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-emerald-400 font-bold text-sm pt-2">
                {trimmed.replace("### ", "")}
              </h3>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-white font-bold text-base pt-2">
                {trimmed.replace("## ", "")}
              </h2>
            );
          }

          if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const listText = trimmed.replace(/^[•\-*]\s*/, "");
            return (
              <div key={idx} className="flex items-start gap-2 ps-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatBold(listText) }} />
              </div>
            );
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
          );
        })}
      </div>
    );
  };

  const formatBold = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong class='text-emerald-300 font-semibold'>$1</strong>")
      .replace(/`([^`]+)`/g, "<code class='px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 font-mono text-xs'>$1</code>");
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
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col h-[calc(100dvh-8rem)] max-w-4xl mx-auto rounded-3xl bg-zinc-900/80 border border-zinc-800/80 overflow-hidden shadow-2xl relative transition-all",
        isDragging && "ring-2 ring-emerald-500 bg-emerald-950/10"
      )}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.txt,.csv,.json,.md"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {/* Chat Header with Model Selector */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">AI Coach & Data Analyzer</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Multimodal & Replies
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Type <span className="text-emerald-400 font-mono">/</span> for slash commands, quote messages, or upload files
            </p>
          </div>
        </div>

        {/* Model Selector Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 min-h-9 rounded-xl bg-zinc-900 border border-zinc-700/70 hover:border-emerald-500/40 text-xs text-zinc-200 transition shadow-inner cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="font-medium">
              {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.label || "Gemini Flash"}
            </span>
            <ChevronDown
              className={cn("w-3.5 h-3.5 text-zinc-400 transition-transform", isModelDropdownOpen && "rotate-180")}
              aria-hidden="true"
            />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute inset-e-0 mt-2 w-72 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-2 z-50 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 select-none">
                Select Analysis Engine
              </div>
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedModel(opt.id);
                    setIsModelDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full text-start p-2.5 min-h-11 rounded-xl text-xs transition flex flex-col gap-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    selectedModel === opt.id
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-white"
                      : "hover:bg-zinc-900 text-zinc-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100">{opt.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-emerald-400 font-medium">
                      {opt.tag}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">{opt.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          const isQuoted = referencedMessages.some((m) => m.id === msg.id);

          return (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-[90%] group",
                isUser ? "ms-auto flex-row-reverse" : "me-auto"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-md",
                  isUser
                    ? "bg-zinc-800 text-zinc-200 border border-zinc-700"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                )}
              >
                {isUser ? <User className="w-4 h-4" aria-hidden="true" /> : <Bot className="w-4 h-4" aria-hidden="true" />}
              </div>

              <div className="space-y-2 flex-1 min-w-0">
                {/* Data Context Badge if attached */}
                {msg.dataContext && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium w-fit">
                    <Database className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{msg.dataContext.badgeLabel}</span>
                    <span className="text-[10px] text-emerald-500/80 tabular-nums">
                      (~{msg.dataContext.tokensEstimated} tokens • 88% saved)
                    </span>
                  </div>
                )}

                {/* Quoted / Referenced Messages Preview Block */}
                {msg.referencedMessages && msg.referencedMessages.length > 0 && (
                  <div className="space-y-1.5 mb-1.5">
                    {msg.referencedMessages.map((ref, i) => (
                      <div
                        key={i}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs border-s-3 backdrop-blur-sm space-y-0.5",
                          isUser
                            ? "bg-zinc-950/60 border-emerald-400 text-zinc-300"
                            : "bg-zinc-900/60 border-emerald-500 text-zinc-300"
                        )}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-[10px] text-emerald-400">
                          <Reply className="w-3 h-3" aria-hidden="true" />
                          <span>{ref.sender === "user" ? "You" : "AI Coach"}</span>
                          {ref.timestamp && <span className="text-zinc-500 font-normal">• {ref.timestamp}</span>}
                        </div>
                        <p className="line-clamp-2 text-zinc-300 text-start">{ref.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attachments Preview in Message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((att) => {
                      const isImg = att.previewUrl || att.type.startsWith("image/");
                      const Icon = getFileIcon(att.type);

                      return isImg ? (
                        <div
                          key={att.id}
                          onClick={() => att.previewUrl && setPreviewModalUrl(att.previewUrl)}
                          className="relative group/att rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 cursor-pointer shadow-md"
                        >
                          <img
                            src={att.previewUrl || `data:${att.type};base64,${att.base64}`}
                            alt={att.name}
                            className="w-32 h-24 object-cover hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/att:opacity-100 transition flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </div>
                        </div>
                      ) : (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-zinc-300 text-xs shadow-md"
                        >
                          <Icon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                          <div className="min-w-0 text-start">
                            <p className="font-semibold text-white truncate max-w-35">{att.name}</p>
                            <p className="text-[10px] text-zinc-500">{formatFileSize(att.size)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Main Message Bubble */}
                <div
                  className={cn(
                    "p-4 rounded-3xl text-sm leading-relaxed shadow-lg relative",
                    isUser
                      ? "bg-emerald-500 text-zinc-950 font-medium rounded-te-none shadow-emerald-500/10"
                      : "bg-zinc-950/80 border border-zinc-800/80 text-zinc-200 rounded-ts-none"
                  )}
                >
                  {isUser ? <p className="whitespace-pre-wrap text-start">{msg.text}</p> : renderFormattedText(msg.text)}
                </div>

                {/* Render Parsed Log Items if any */}
                {msg.logItems && msg.logItems.length > 0 && (
                  <div className="p-3 rounded-2xl bg-zinc-950/60 border border-emerald-500/20 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Logged to your database:</span>
                    </div>
                    <div className="space-y-1">
                      {msg.logItems.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900/60 text-zinc-300"
                        >
                          {item.type === "meal" && <UtensilsCrossed className="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />}
                          {item.type === "water" && <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />}
                          {item.type === "steps" && <Footprints className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />}
                          <span className="font-semibold text-white">{item.description}</span>
                          {item.macros && (
                            <span className="text-[11px] text-zinc-400 tabular-nums">
                              ({item.macros.calories} kcal, P: {item.macros.protein}g)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Footer: Timestamp & Reply Action Button */}
                <div className={cn("flex items-center gap-2 px-1 text-[10px] text-zinc-500", isUser && "justify-end")}>
                  <span>{msg.timestamp}</span>
                  {msg.modelUsed && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-400">{msg.modelUsed}</span>
                    </>
                  )}

                  {/* Reply Button */}
                  <button
                    type="button"
                    onClick={() => toggleQuoteMessage(msg)}
                    className={cn(
                      "ms-1.5 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400",
                      isQuoted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "opacity-70 hover:opacity-100 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400"
                    )}
                    aria-label="Quote this message in reply"
                  >
                    <Reply className="w-3 h-3" aria-hidden="true" />
                    <span>{isQuoted ? "Referenced" : "Reply"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-zinc-400 text-xs py-3 px-4 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" aria-hidden="true" />
            <span>Analyzing multimodal context with {selectedModel}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Discord-Style Command Autocomplete Palette */}
      {showCommandPalette && filteredCommands.length > 0 && (
        <div className="absolute bottom-24 inset-s-4 inset-e-4 max-h-72 overflow-y-auto rounded-2xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md p-2 z-40 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/60 text-[11px] text-zinc-400">
            <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
              Matching Commands ({filteredCommands.length})
            </span>
            <span className="text-[10px] text-zinc-500">
              Navigate: <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">↓</kbd> Select: <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">Tab</kbd>
            </span>
          </div>

          <div className="space-y-1 pt-1">
            {filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedCmdIndex;

              return (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => selectCommand(cmd)}
                  className={cn(
                    "w-full text-start px-3 py-2.5 rounded-xl transition flex items-center justify-between group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    isSelected
                      ? "bg-emerald-500/20 text-white border border-emerald-500/40"
                      : "hover:bg-zinc-900 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        isSelected ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"
                      )}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white group-hover:text-emerald-300">
                          {cmd.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {cmd.syntax}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate max-w-md">
                        {cmd.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {cmd.dayOptions && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
                        {cmd.defaultDays}d default
                      </span>
                    )}
                    <CornerDownLeft className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition" aria-hidden="true" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Command Options Bar */}
      {activeCommand && (
        <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-zinc-950 font-bold flex items-center gap-1.5 shadow-sm">
              <activeCommand.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {activeCommand.name}
            </span>

            {/* Day Option Chips */}
            {activeCommand.dayOptions && activeCommand.dayOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 text-[11px]">Days:</span>
                {activeCommand.dayOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDays(d)}
                    className={cn(
                      "px-2 py-0.5 rounded-md font-semibold text-[11px] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                      selectedDays === d
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                    )}
                  >
                    {d}d
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
            className="text-zinc-500 hover:text-zinc-300 text-[11px] underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Quoted / Referenced Messages Tray (Above Input) */}
      {referencedMessages.length > 0 && (
        <div className="px-4 py-2 bg-zinc-950/90 border-t border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Reply className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Referencing {referencedMessages.length} previous message{referencedMessages.length > 1 ? "s" : ""}</span>
            </span>
            <button
              type="button"
              onClick={clearAllQuotes}
              className="text-zinc-500 hover:text-zinc-300 text-[10px] underline cursor-pointer"
            >
              Clear all
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {referencedMessages.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 shrink-0 max-w-xs"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  {ref.sender === "user" ? (
                    <User className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Bot className="w-2.5 h-2.5 text-emerald-400" />
                  )}
                </div>
                <span className="truncate max-w-45 text-zinc-300">{ref.text}</span>
                <button
                  type="button"
                  onClick={() => removeQuotedMessage(ref.id)}
                  className="text-zinc-500 hover:text-red-400 p-0.5 rounded cursor-pointer"
                  aria-label="Remove quoted message"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments Preview Tray (Above Input) */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto pb-1">
          {attachments.map((att) => {
            const isImg = att.previewUrl || att.type.startsWith("image/");
            const Icon = getFileIcon(att.type);

            return (
              <div
                key={att.id}
                className="flex items-center gap-2 p-1.5 ps-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 shrink-0"
              >
                {isImg ? (
                  <img
                    src={att.previewUrl || `data:${att.type};base64,${att.base64}`}
                    alt={att.name}
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                ) : (
                  <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0 max-w-30">
                  <p className="text-[11px] font-semibold text-white truncate">{att.name}</p>
                  <p className="text-[9px] text-zinc-400">{formatFileSize(att.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="text-zinc-500 hover:text-red-400 p-1 rounded cursor-pointer"
                  aria-label="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 flex items-center gap-2">
        {/* Attachment Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach images or files"
          className="p-3 min-h-11 min-w-11 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-emerald-400 transition flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Paperclip className="w-4 h-4" aria-hidden="true" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            activeCommand
              ? activeCommand.samplePrompt || "Add custom instructions or press Send..."
              : referencedMessages.length > 0
              ? "Ask a question about referenced messages..."
              : "Type / for commands, quote messages, or ask anything..."
          }
          className="flex-1 px-4 py-3 min-h-11 bg-zinc-900 border border-zinc-700/60 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        />

        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={(!input.trim() && !activeCommand && attachments.length === 0) || isLoading}
          aria-label="Send message to AI Coach"
          className="p-3 min-h-11 min-w-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition disabled:opacity-50 flex items-center justify-center shadow-lg shadow-emerald-500/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Image Lightbox Modal */}
      {previewModalUrl && (
        <Modal
          isOpen={Boolean(previewModalUrl)}
          onClose={() => setPreviewModalUrl(null)}
          title="Image Attachment Preview"
          size="lg"
        >
          <div className="flex items-center justify-center p-2">
            <img
              src={previewModalUrl}
              alt="Attachment preview"
              className="max-h-[70vh] rounded-xl object-contain shadow-2xl"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default CoachClient;
