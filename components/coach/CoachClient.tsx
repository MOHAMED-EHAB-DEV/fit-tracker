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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataContextSummary, GeminiModelChoice } from "@/types/gemini";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  commandName?: string;
  modelUsed?: string;
  dataContext?: DataContextSummary | null;
  logItems?: any[];
  timestamp: string;
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

export function CoachClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "assistant",
      text: "👋 **Welcome to your AI Strength & Nutrition Coach!**\n\nType `/` to browse available data & analysis commands, or tell me what you ate/drank to log items instantly.",
      timestamp: "Just now",
      modelUsed: "gemini-flash-lite",
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<GeminiModelChoice>("gemini-flash-lite");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Command palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<CommandDef | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
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
      return;
    }

    if (cmd.name === "/help") {
      const helpText = `### 📋 Available AI Coach Slash Commands\n\n` +
        COMMAND_DEFINITIONS.map(
          (c) => `• **\`${c.syntax}\`**: ${c.description}`
        ).join("\n") +
        `\n\n💡 **Tip**: You can select day options (e.g. \`7d\`, \`14d\`, \`30d\`) or attach a custom question at the end of any command!`;

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

  const sendMessage = async (overrideText?: string) => {
    let finalMessage = (overrideText || input).trim();

    // If there is an active command selected
    if (activeCommand && !overrideText) {
      const daysPart = selectedDays && selectedDays > 1 ? ` ${selectedDays}d` : "";
      const promptPart = input.trim() ? ` ${input.trim()}` : "";
      finalMessage = `${activeCommand.name}${daysPart}${promptPart}`.trim();
    }

    if (!finalMessage || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: finalMessage,
      commandName: activeCommand?.name,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveCommand(null);
    setSelectedDays(null);
    setShowCommandPalette(false);
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          model: selectedModel,
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
      <div className="space-y-1.5 text-sm leading-relaxed">
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
              <div key={idx} className="flex items-start gap-2 pl-2">
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
    <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-4xl mx-auto rounded-2xl bg-zinc-900/80 border border-zinc-800/80 overflow-hidden shadow-2xl relative">
      {/* Chat Header with Model Selector */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">AI Coach & Data Analyzer</h2>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Slash Commands
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Type <span className="text-emerald-400 font-mono">/</span> for high-density token-optimized data injection</p>
          </div>
        </div>

        {/* Model Selector Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 min-h-9 rounded-xl bg-zinc-900 border border-zinc-700/70 hover:border-emerald-500/40 text-xs text-zinc-200 transition shadow-inner cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="font-medium">
              {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.label || "Gemini Flash"}
            </span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-400 transition-transform", isModelDropdownOpen && "rotate-180")} aria-hidden="true" />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl p-2 z-50 space-y-1">
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
                    "w-full text-left p-2.5 min-h-11 rounded-lg text-xs transition flex flex-col gap-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
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

          return (
            <div
              key={msg.id}
              className={cn("flex gap-3 max-w-[88%]", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}
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

              <div className="space-y-2">
                {/* Data Context Badge if attached */}
                {msg.dataContext && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium w-fit">
                    <Database className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{msg.dataContext.badgeLabel}</span>
                    <span className="text-[10px] text-emerald-500/80 tabular-nums">
                      (~{msg.dataContext.tokensEstimated} tokens • 88% saved)
                    </span>
                  </div>
                )}

                <div
                  className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-lg",
                    isUser
                      ? "bg-emerald-500 text-zinc-950 font-medium rounded-tr-none shadow-emerald-500/10"
                      : "bg-zinc-950/80 border border-zinc-800/80 text-zinc-200 rounded-tl-none"
                  )}
                >
                  {isUser ? <p className="whitespace-pre-wrap">{msg.text}</p> : renderFormattedText(msg.text)}
                </div>

                {/* Render Parsed Log Items if any */}
                {msg.logItems && msg.logItems.length > 0 && (
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-emerald-500/20 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Logged to your database:</span>
                    </div>
                    <div className="space-y-1">
                      {msg.logItems.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-900/60 text-zinc-300"
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

                <div className="flex items-center gap-2 px-1 text-[10px] text-zinc-500">
                  <span>{msg.timestamp}</span>
                  {msg.modelUsed && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-400">{msg.modelUsed}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-zinc-400 text-xs py-3 px-4 bg-zinc-950/60 rounded-xl border border-zinc-800/80 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" aria-hidden="true" />
            <span>Analyzing compressed data context with {selectedModel}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Discord-Style Command Autocomplete Palette */}
      {showCommandPalette && filteredCommands.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 max-h-72 overflow-y-auto rounded-2xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md p-2 z-40 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
                    "w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    isSelected
                      ? "bg-emerald-500/20 text-white border border-emerald-500/40"
                      : "hover:bg-zinc-900 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? "bg-emerald-500 text-zinc-950" : "bg-zinc-900 text-zinc-400"
                    )}>
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

      {/* Discord-style Active Command Options Bar */}
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

      {/* Input Bar */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            activeCommand
              ? activeCommand.samplePrompt || "Add custom instructions or press Send..."
              : "Type / for data analysis commands, or ask a question / log food..."
          }
          className="flex-1 px-4 py-3 min-h-11 bg-zinc-900 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={(!input.trim() && !activeCommand) || isLoading}
          aria-label="Send message to AI Coach"
          className="p-3 min-h-11 min-w-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition disabled:opacity-50 flex items-center justify-center shadow-lg shadow-emerald-500/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default CoachClient;
