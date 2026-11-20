import type { DataContextSummary } from "@/types/gemini";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"] as const;
export type MealTypeId = (typeof MEAL_TYPES)[number];

/** A previous turn sent back to the server as conversation context. */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/** A message the user quoted in their question. */
export interface QuotedMessage {
  sender: "user" | "assistant";
  text: string;
}

export interface ChatAttachmentPayload {
  name: string;
  type: string;
  /** Base64 of the file bytes (no data: prefix). */
  base64: string;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatTurn[];
  quotes?: QuotedMessage[];
  attachments?: ChatAttachmentPayload[];
}

interface ProposalBase {
  /** Client-side identity of the card; also the idempotency key on commit. */
  id: string;
  date: string;
}

export interface MealProposal extends ProposalBase {
  kind: "meal";
  description: string;
  mealType: MealTypeId;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface WaterProposal extends ProposalBase {
  kind: "water";
  amountMl: number;
}

export interface StepsProposal extends ProposalBase {
  kind: "steps";
  /** The day's total step count (replaces the stored total). */
  count: number;
}

export interface WeightProposal extends ProposalBase {
  kind: "weight";
  weight: number;
  unit: "kg" | "lbs";
}

export type LogProposal = MealProposal | WaterProposal | StepsProposal | WeightProposal;

export interface ChatResponseBody {
  reply: string;
  proposals: LogProposal[];
  modelUsed: string;
  commandDetected: string | null;
  dataContext: DataContextSummary | null;
  /** Shown under the reply, e.g. why nothing can be logged from an attachment. */
  notice?: string | null;
}

export interface CommitResponseBody {
  /** True when this commit id had already been applied (a retry). */
  alreadyApplied: boolean;
  summary: string;
}
