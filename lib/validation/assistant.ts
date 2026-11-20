import { z } from "zod";
import { boundedInt, boundedNumber, dateString, mealType, trimmedText, weightUnit } from "@/lib/validation/common";

/** Request limits for the coach. Keep the JSON body well under the 4 MB platform limit. */
export const CHAT_LIMITS = {
  messageChars: 4_000,
  historyTurns: 12,
  historyChars: 4_000,
  quotes: 5,
  quoteChars: 2_000,
  attachments: 4,
  /** Decoded bytes across all attachments. */
  totalAttachmentBytes: 2_500_000,
  /** Characters of one text file passed to the model. */
  textFileChars: 20_000,
  /** Characters of all text files together. */
  totalTextChars: 40_000,
  /** Whole JSON body. */
  maxBodyBytes: 3_800_000,
} as const;

const MAX_BASE64_CHARS = Math.ceil((CHAT_LIMITS.totalAttachmentBytes * 4) / 3) + 16;

export const chatRequestSchema = z
  .object({
    message: z.string().trim().max(CHAT_LIMITS.messageChars, `Keep messages under ${CHAT_LIMITS.messageChars} characters`).optional().default(""),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(CHAT_LIMITS.historyChars) }))
      .max(CHAT_LIMITS.historyTurns)
      .optional()
      .default([]),
    quotes: z
      .array(z.object({ sender: z.enum(["user", "assistant"]), text: z.string().max(CHAT_LIMITS.quoteChars) }))
      .max(CHAT_LIMITS.quotes, `Quote at most ${CHAT_LIMITS.quotes} messages`)
      .optional()
      .default([]),
    attachments: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          type: z.string().max(100).optional().default(""),
          base64: z.string().min(1).max(MAX_BASE64_CHARS, "Attachment is too large"),
        })
      )
      .max(CHAT_LIMITS.attachments, `Attach at most ${CHAT_LIMITS.attachments} files`)
      .optional()
      .default([]),
  })
  .refine((body) => body.message.length > 0 || body.attachments.length > 0, {
    message: "Type a message or attach a file",
    path: ["message"],
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Limits for anything the assistant can log (also used to clamp model output). */
export const LOG_LIMITS = {
  calories: 10_000,
  protein: 1_000,
  carbs: 1_500,
  fat: 1_000,
  fiber: 300,
  waterMl: 5_000,
  steps: 100_000,
  weightKgMin: 20,
  weightKgMax: 400,
  /** How far back a chat log may be dated. */
  maxPastDays: 30,
} as const;

const proposalId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid id");

export const mealProposalSchema = z.object({
  kind: z.literal("meal"),
  id: proposalId,
  date: dateString,
  description: trimmedText(200, 1),
  mealType,
  calories: boundedNumber(0, LOG_LIMITS.calories),
  protein: boundedNumber(0, LOG_LIMITS.protein),
  carbs: boundedNumber(0, LOG_LIMITS.carbs),
  fat: boundedNumber(0, LOG_LIMITS.fat),
  fiber: boundedNumber(0, LOG_LIMITS.fiber).optional().default(0),
});

export const waterProposalSchema = z.object({
  kind: z.literal("water"),
  id: proposalId,
  date: dateString,
  amountMl: boundedInt(1, LOG_LIMITS.waterMl),
});

export const stepsProposalSchema = z.object({
  kind: z.literal("steps"),
  id: proposalId,
  date: dateString,
  count: boundedInt(0, LOG_LIMITS.steps),
});

export const weightProposalSchema = z.object({
  kind: z.literal("weight"),
  id: proposalId,
  date: dateString,
  weight: boundedNumber(1, 1_000),
  unit: weightUnit,
});

export const logProposalSchema = z.discriminatedUnion("kind", [
  mealProposalSchema,
  waterProposalSchema,
  stepsProposalSchema,
  weightProposalSchema,
]);

export const commitRequestSchema = z.object({
  /** Client-generated; a retry with the same id never logs twice. */
  commitId: proposalId,
  proposal: logProposalSchema,
});

export type CommitRequest = z.infer<typeof commitRequestSchema>;
