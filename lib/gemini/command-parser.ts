export interface ParsedCoachCommand {
  isCommand: boolean;
  commandName?: string;
  dataType?: "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today";
  days?: number;
  modelOverride?: string;
  userPrompt: string;
  originalMessage: string;
  coachingFocus?: string;
}

/**
 * Parses user chat text to detect slash commands, data extraction intents, day ranges, model overrides, and user prompt.
 */
export function parseCoachCommand(text: string, defaultModel?: string): ParsedCoachCommand {
  const trimmed = text.trim();
  let cleanText = trimmed;
  let modelOverride = defaultModel;

  // 1. Check for inline model flags like /model:pro, /model:flash, --model=pro, etc.
  const modelMatch = cleanText.match(/\/(model|engine):([a-zA-Z0-9._-]+)/i) ||
    cleanText.match(/--model=([a-zA-Z0-9._-]+)/i);
  if (modelMatch) {
    modelOverride = modelMatch[2] || modelMatch[1];
    cleanText = cleanText.replace(modelMatch[0], "").trim();
  }

  // 2. Check for slash commands
  const slashMatch = cleanText.match(/^\/([a-zA-Z0-9_:-]+)(\s+.*)?$/i);

  if (!slashMatch) {
    // Check if message is a general data request or contains inline /data:...
    const inlineDataMatch = cleanText.match(/\/data:?([a-zA-Z0-9_-]+)?(\s+(\d+)d?)?/i);
    if (inlineDataMatch) {
      const sub = (inlineDataMatch[1] || "all").toLowerCase();
      const numDays = inlineDataMatch[3] ? parseInt(inlineDataMatch[3], 10) : undefined;
      const promptWithoutCmd = cleanText.replace(inlineDataMatch[0], "").trim();

      const dataType = resolveDataType(sub);
      return {
        isCommand: true,
        commandName: `/data:${sub}`,
        dataType,
        days: numDays || defaultDaysForType(dataType),
        modelOverride,
        userPrompt: promptWithoutCmd || `Analyze my ${dataType} data for the past ${numDays || defaultDaysForType(dataType)} days.`,
        originalMessage: text,
      };
    }

    return {
      isCommand: false,
      modelOverride,
      userPrompt: trimmed,
      originalMessage: text,
    };
  }

  const rawCmd = slashMatch[1].toLowerCase();
  const rest = (slashMatch[2] || "").trim();

  // Extract optional day number from the start of rest (e.g. "30d", "14", "60 days")
  let days: number | undefined = undefined;
  let promptText = rest;

  const daysMatch = rest.match(/^(\d+)(d|days)?\s*(.*)$/i);
  if (daysMatch) {
    days = parseInt(daysMatch[1], 10);
    promptText = (daysMatch[3] || "").trim();
  }

  // Handle Command Routes
  if (rawCmd.startsWith("data:") || rawCmd === "data") {
    const sub = rawCmd.includes(":") ? rawCmd.split(":")[1] : (promptText.split(" ")[0] || "all");
    if (!rawCmd.includes(":") && promptText.startsWith(sub)) {
      promptText = promptText.replace(new RegExp(`^${sub}\\s*`, "i"), "").trim();
      const secondDaysMatch = promptText.match(/^(\d+)(d|days)?\s*(.*)$/i);
      if (secondDaysMatch) {
        days = parseInt(secondDaysMatch[1], 10);
        promptText = (secondDaysMatch[3] || "").trim();
      }
    }

    const dataType = resolveDataType(sub);
    const resolvedDays = days || defaultDaysForType(dataType);

    return {
      isCommand: true,
      commandName: `/data:${sub}`,
      dataType,
      days: resolvedDays,
      modelOverride,
      userPrompt: promptText || `Analyze my ${dataType} data for the last ${resolvedDays} days and provide actionable insights.`,
      originalMessage: text,
    };
  }

  // Specialized shortcuts
  if (rawCmd === "meals" || rawCmd === "nutrition" || rawCmd === "diet") {
    const resolvedDays = days || 30;
    return {
      isCommand: true,
      commandName: `/${rawCmd}`,
      dataType: "meals",
      days: resolvedDays,
      modelOverride,
      userPrompt: promptText || `Review my last ${resolvedDays} days of meals, macro adherence, and calorie consistency.`,
      originalMessage: text,
    };
  }

  if (rawCmd === "workouts" || rawCmd === "training" || rawCmd === "gym") {
    const resolvedDays = days || 14;
    return {
      isCommand: true,
      commandName: `/${rawCmd}`,
      dataType: "workouts",
      days: resolvedDays,
      modelOverride,
      userPrompt: promptText || `Analyze my last ${resolvedDays} days of workout sessions, muscle group volume, and intensity.`,
      originalMessage: text,
    };
  }

  if (rawCmd === "bodycomp" || rawCmd === "weight" || rawCmd === "physique") {
    const resolvedDays = days || 60;
    return {
      isCommand: true,
      commandName: `/${rawCmd}`,
      dataType: "bodycomp",
      days: resolvedDays,
      modelOverride,
      userPrompt: promptText || `Evaluate my body composition, weight trend, and progress check-ins over the last ${resolvedDays} days.`,
      originalMessage: text,
    };
  }

  if (rawCmd === "progress" || rawCmd === "report" || rawCmd === "all") {
    const resolvedDays = days || 30;
    return {
      isCommand: true,
      commandName: `/${rawCmd}`,
      dataType: "all",
      days: resolvedDays,
      modelOverride,
      userPrompt: promptText || `Provide a holistic 360-degree review of my nutrition, workouts, and body composition over the last ${resolvedDays} days.`,
      originalMessage: text,
    };
  }

  if (rawCmd === "summary" || rawCmd === "today") {
    return {
      isCommand: true,
      commandName: `/${rawCmd}`,
      dataType: "today",
      days: 1,
      modelOverride,
      userPrompt: promptText || "Give me a live status breakdown of today's calories, remaining macros, water, and workouts.",
      originalMessage: text,
    };
  }

  // Analytical coaching commands
  if (rawCmd === "plateau" || rawCmd === "analyze:plateau") {
    return {
      isCommand: true,
      commandName: "/plateau",
      dataType: "all",
      days: 30,
      modelOverride,
      coachingFocus: "plateau_diagnosis",
      userPrompt: promptText || "Diagnose why my progress or strength is plateauing and provide corrective nutrition and volume adjustments.",
      originalMessage: text,
    };
  }

  if (rawCmd === "macros" || rawCmd === "analyze:macros") {
    const resolvedDays = days || 14;
    return {
      isCommand: true,
      commandName: "/macros",
      dataType: "meals",
      days: resolvedDays,
      modelOverride,
      coachingFocus: "macro_partitioning",
      userPrompt: promptText || `Perform a deep breakdown of my protein distribution, meal timing, and macro ratios over the last ${resolvedDays} days.`,
      originalMessage: text,
    };
  }

  if (rawCmd === "volume" || rawCmd === "analyze:volume") {
    const resolvedDays = days || 14;
    return {
      isCommand: true,
      commandName: "/volume",
      dataType: "workouts",
      days: resolvedDays,
      modelOverride,
      coachingFocus: "hypertrophy_volume",
      userPrompt: promptText || `Calculate my weekly direct sets per muscle group and compare against optimal hypertrophy volume landmarks (MEV/MAV/MRV).`,
      originalMessage: text,
    };
  }

  if (rawCmd === "prs" || rawCmd === "analyze:prs") {
    const resolvedDays = days || 30;
    return {
      isCommand: true,
      commandName: "/prs",
      dataType: "workouts",
      days: resolvedDays,
      modelOverride,
      coachingFocus: "strength_progression",
      userPrompt: promptText || `Analyze my personal records and strength progression on compound exercises over the last ${resolvedDays} days.`,
      originalMessage: text,
    };
  }

  if (rawCmd === "recalc" || rawCmd === "plan:recalc") {
    return {
      isCommand: true,
      commandName: "/recalc",
      dataType: "all",
      days: 30,
      modelOverride,
      coachingFocus: "target_recalculation",
      userPrompt: promptText || "Based on my actual 30-day rate of weight change and intake, recalculate my optimal calorie and protein targets.",
      originalMessage: text,
    };
  }

  // Fallback for unknown slash command
  return {
    isCommand: true,
    commandName: `/${rawCmd}`,
    dataType: "all",
    days: 30,
    modelOverride,
    userPrompt: cleanText,
    originalMessage: text,
  };
}

function resolveDataType(sub: string): "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today" {
  const lower = sub.toLowerCase();
  if (lower.includes("meal") || lower.includes("nutri") || lower.includes("diet") || lower.includes("food")) return "meals";
  if (lower.includes("workout") || lower.includes("train") || lower.includes("gym") || lower.includes("lift")) return "workouts";
  if (lower.includes("body") || lower.includes("comp") || lower.includes("weight") || lower.includes("physique")) return "bodycomp";
  if (lower.includes("prog") || lower.includes("trend")) return "progress";
  if (lower.includes("today") || lower.includes("live") || lower.includes("now")) return "today";
  return "all";
}

function defaultDaysForType(dataType: "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today"): number {
  switch (dataType) {
    case "today": return 1;
    case "workouts": return 14;
    case "bodycomp": return 60;
    case "meals": return 30;
    case "progress": return 30;
    case "all": return 30;
    default: return 30;
  }
}
