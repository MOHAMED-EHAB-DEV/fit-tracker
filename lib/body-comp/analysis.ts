/**
 * Parsing and clamping of the body-composition AI answer (pure, isomorphic).
 * Model output is never trusted: every field is type-checked, trimmed,
 * length-capped and the body-fat value is clamped to a plausible range.
 */

export const AI_BODY_FAT_MIN = 3;
export const AI_BODY_FAT_MAX = 60;

export interface AnalysisProposal {
  qualitativeNotes: string;
  estimatedBodyFatPercent: number | null;
  estimatedBodyFatRange: string;
  comparedToPrevious: string;
  muscleGroupHighlights: string[];
  recommendations: string[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown, maxItems: number, maxLength: number): string[] =>
  Array.isArray(v)
    ? v
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

function clampBodyFat(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(AI_BODY_FAT_MAX, Math.max(AI_BODY_FAT_MIN, value));
  return Math.round(clamped * 10) / 10;
}

/** Midpoint of "12.0% – 14.0%" (or the single number in "13%"). */
export function bodyFatFromRange(range: string): number | null {
  const matches = range.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const numbers = matches.slice(0, 2).map(Number);
  const value = numbers.length === 2 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
  return clampBodyFat(value);
}

export class AnalysisParseError extends Error {
  constructor() {
    super("The AI returned an answer that could not be read. Please try again.");
    this.name = "AnalysisParseError";
  }
}

/** Parses the model's JSON text into a clamped proposal; throws AnalysisParseError. */
export function parseAnalysisText(text: string | undefined | null): AnalysisProposal {
  if (!text) throw new AnalysisParseError();
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AnalysisParseError();
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new AnalysisParseError();
  const obj = json as Record<string, unknown>;
  const raw = {
    qualitativeNotes: str(obj.qualitativeNotes),
    estimatedBodyFatPercent: obj.estimatedBodyFatPercent,
    estimatedBodyFatRange: str(obj.estimatedBodyFatRange),
    comparedToPrevious: str(obj.comparedToPrevious),
    muscleGroupHighlights: list(obj.muscleGroupHighlights, 12, 160),
    recommendations: list(obj.recommendations, 10, 500),
  };

  const range = raw.estimatedBodyFatRange.slice(0, 60);
  let bodyFat =
    typeof raw.estimatedBodyFatPercent === "number" ? clampBodyFat(raw.estimatedBodyFatPercent) : null;
  if (bodyFat === null && range) bodyFat = bodyFatFromRange(range);

  const proposal: AnalysisProposal = {
    qualitativeNotes: raw.qualitativeNotes.slice(0, 4000),
    estimatedBodyFatPercent: bodyFat,
    estimatedBodyFatRange: range || (bodyFat !== null ? `${bodyFat}%` : ""),
    comparedToPrevious: raw.comparedToPrevious.slice(0, 2000),
    muscleGroupHighlights: raw.muscleGroupHighlights,
    recommendations: raw.recommendations,
  };
  if (!proposal.qualitativeNotes && proposal.estimatedBodyFatPercent === null) throw new AnalysisParseError();
  return proposal;
}
