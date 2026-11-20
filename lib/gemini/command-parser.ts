export type CoachDataType = "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today";

export interface ParsedCoachCommand {
  isCommand: boolean;
  commandName?: string;
  dataType?: CoachDataType;
  days?: number;
  userPrompt: string;
  originalMessage: string;
  coachingFocus?: string;
}

export const MIN_DAYS = 1;
export const MAX_DAYS = 90;

export function clampDays(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(value)));
}

/** A data-type keyword, or null when the word is not one. */
export function matchDataType(word: string): CoachDataType | null {
  const lower = word.toLowerCase();
  if (!lower) return null;
  if (/^(meals?|nutrition|diet|food|macros)$/.test(lower)) return "meals";
  if (/^(workouts?|training|gym|lifts?|lifting)$/.test(lower)) return "workouts";
  if (/^(bodycomp|body|comp|weight|physique)$/.test(lower)) return "bodycomp";
  if (/^(progress|trends?)$/.test(lower)) return "progress";
  if (/^(today|live|now)$/.test(lower)) return "today";
  if (/^(all|everything)$/.test(lower)) return "all";
  return null;
}

export function defaultDaysForType(dataType: CoachDataType): number {
  switch (dataType) {
    case "today":
      return 1;
    case "workouts":
      return 14;
    case "bodycomp":
      return 60;
    default:
      return 30;
  }
}

const DAYS_TOKEN = /^(\d{1,4})(?:d|days?)?$/i;

/** Reads an optional leading "30", "30d" or "30 days" from words; returns the rest. */
function takeDays(words: string[]): { days?: number; rest: string[] } {
  if (words.length === 0) return { rest: words };
  const match = DAYS_TOKEN.exec(words[0]);
  if (!match) return { rest: words };
  const rest = words.slice(1);
  if (/^\d+$/.test(words[0]) && rest[0] && /^days?$/i.test(rest[0])) rest.shift();
  return { days: Number(match[1]), rest };
}

interface Shortcut {
  dataType: CoachDataType;
  days?: number;
  name?: string;
  focus?: string;
  prompt: (days: number) => string;
}

const SHORTCUTS: Record<string, Shortcut> = {
  meals: { dataType: "meals", prompt: (d) => `Review my last ${d} days of meals, macro adherence and calorie consistency.` },
  nutrition: { dataType: "meals", prompt: (d) => `Review my last ${d} days of meals, macro adherence and calorie consistency.` },
  diet: { dataType: "meals", prompt: (d) => `Review my last ${d} days of meals, macro adherence and calorie consistency.` },
  workouts: { dataType: "workouts", prompt: (d) => `Analyze my last ${d} days of workouts, muscle group volume and intensity.` },
  training: { dataType: "workouts", prompt: (d) => `Analyze my last ${d} days of workouts, muscle group volume and intensity.` },
  gym: { dataType: "workouts", prompt: (d) => `Analyze my last ${d} days of workouts, muscle group volume and intensity.` },
  bodycomp: { dataType: "bodycomp", prompt: (d) => `Evaluate my weight trend and check-ins over the last ${d} days.` },
  weight: { dataType: "bodycomp", prompt: (d) => `Evaluate my weight trend and check-ins over the last ${d} days.` },
  physique: { dataType: "bodycomp", prompt: (d) => `Evaluate my weight trend and check-ins over the last ${d} days.` },
  progress: { dataType: "all", prompt: (d) => `Give me a complete review of my nutrition, training and body weight over the last ${d} days.` },
  report: { dataType: "all", prompt: (d) => `Give me a complete review of my nutrition, training and body weight over the last ${d} days.` },
  all: { dataType: "all", prompt: (d) => `Give me a complete review of my nutrition, training and body weight over the last ${d} days.` },
  summary: { dataType: "today", days: 1, prompt: () => "Give me a status of today's calories, remaining macros, water, steps and workouts." },
  today: { dataType: "today", days: 1, prompt: () => "Give me a status of today's calories, remaining macros, water, steps and workouts." },
  plateau: {
    dataType: "all",
    days: 30,
    name: "/plateau",
    focus: "plateau_diagnosis",
    prompt: () => "Diagnose why my progress or strength is stalling and suggest nutrition and training adjustments.",
  },
  macros: {
    dataType: "meals",
    name: "/macros",
    focus: "macro_partitioning",
    prompt: (d) => `Break down my protein distribution, meal timing and macro ratios over the last ${d} days.`,
  },
  volume: {
    dataType: "workouts",
    name: "/volume",
    focus: "hypertrophy_volume",
    prompt: () => "Calculate my weekly working sets per muscle group and compare them with hypertrophy volume landmarks (MEV/MAV/MRV).",
  },
  prs: {
    dataType: "workouts",
    days: undefined,
    name: "/prs",
    focus: "strength_progression",
    prompt: (d) => `Analyze my personal records and strength progression over the last ${d} days.`,
  },
  recalc: {
    dataType: "all",
    days: 30,
    name: "/recalc",
    focus: "target_recalculation",
    prompt: () => "Based on my actual rate of weight change and intake, recalculate my calorie and protein targets.",
  },
};

const SHORTCUT_ALIASES: Record<string, string> = {
  "analyze:plateau": "plateau",
  "analyze:macros": "macros",
  "analyze:volume": "volume",
  "analyze:prs": "prs",
  "plan:recalc": "recalc",
};

/**
 * Parses a coach message: slash commands, "/data" requests and day ranges.
 * Never builds a RegExp from user text. The server chooses the AI model: a
 * "/model:x" or "--model=x" token is dropped from the text and has no effect.
 */
export function parseCoachCommand(text: string): ParsedCoachCommand {
  const trimmed = text.trim();
  let cleanText = trimmed;
  const modelMatch = /(?:^|\s)(?:\/(?:model|engine):|--model=)([a-zA-Z0-9._-]{1,40})/i.exec(cleanText);
  if (modelMatch) {
    cleanText = (cleanText.slice(0, modelMatch.index) + cleanText.slice(modelMatch.index + modelMatch[0].length)).trim();
  }

  const slashMatch = /^\/([a-zA-Z0-9_:-]{1,40})(?:\s+([\s\S]*))?$/.exec(cleanText);

  if (!slashMatch) {
    const inline = /(?:^|\s)\/data(?::([a-zA-Z]{1,20}))?(?:\s+(\d{1,4})d?\b)?/i.exec(cleanText);
    if (inline) {
      const dataType = (inline[1] && matchDataType(inline[1])) || "all";
      const days = clampDays(inline[2] ? Number(inline[2]) : undefined, defaultDaysForType(dataType));
      const prompt = (cleanText.slice(0, inline.index) + cleanText.slice(inline.index + inline[0].length)).trim();
      return {
        isCommand: true,
        commandName: `/data:${dataType}`,
        dataType,
        days,
        userPrompt: prompt || `Analyze my ${dataType} data for the last ${days} days.`,
        originalMessage: text,
      };
    }
    return { isCommand: false, userPrompt: cleanText, originalMessage: text };
  }

  const rawCmd = slashMatch[1].toLowerCase();
  let words = (slashMatch[2] || "").trim().split(/\s+/).filter(Boolean);

  let { days, rest } = takeDays(words);
  words = rest;

  if (rawCmd === "data" || rawCmd.startsWith("data:")) {
    let dataType: CoachDataType = "all";
    if (rawCmd.includes(":")) {
      dataType = matchDataType(rawCmd.split(":")[1] || "") || "all";
    } else if (words.length > 0) {
      const keyword = matchDataType(words[0]);
      if (keyword) {
        dataType = keyword;
        words = words.slice(1);
        if (days === undefined) {
          ({ days, rest } = takeDays(words));
          words = rest;
        }
      }
    }
    const resolvedDays = clampDays(days, defaultDaysForType(dataType));
    return {
      isCommand: true,
      commandName: `/data:${dataType}`,
      dataType,
      days: resolvedDays,
      userPrompt: words.join(" ") || `Analyze my ${dataType} data for the last ${resolvedDays} days and give me actionable insights.`,
      originalMessage: text,
    };
  }

  const shortcut = SHORTCUTS[SHORTCUT_ALIASES[rawCmd] || rawCmd];
  if (shortcut) {
    const resolvedDays = shortcut.days ?? clampDays(days, defaultDaysForType(shortcut.dataType));
    return {
      isCommand: true,
      commandName: shortcut.name || `/${rawCmd}`,
      dataType: shortcut.dataType,
      days: resolvedDays,
      coachingFocus: shortcut.focus,
      userPrompt: words.join(" ") || shortcut.prompt(resolvedDays),
      originalMessage: text,
    };
  }

  // Unknown slash command: treat the text as a question with the full context.
  return {
    isCommand: true,
    commandName: `/${rawCmd}`,
    dataType: "all",
    days: clampDays(days, 30),
    userPrompt: words.join(" ") || cleanText,
    originalMessage: text,
  };
}
