import type { DataContextSummary } from "@/types/gemini";
import type { LogProposal } from "@/lib/assistant/types";

/**
 * AI Coach history kept in this browser (per account) so a reload or a
 * navigation does not lose the conversation or unconfirmed log cards.
 * Attachment contents are never stored, only their names.
 */

export type ProposalStatus = "pending" | "saving" | "saved" | "dismissed" | "error";

export interface ProposalState {
  proposal: LogProposal;
  /** Idempotency key for POST /api/assistant/commit; kept across retries. */
  commitId: string;
  status: ProposalStatus;
  error?: string;
}

export interface StoredAttachment {
  name: string;
  type: string;
  size: number;
}

export interface StoredQuote {
  id: string;
  sender: "user" | "assistant";
  text: string;
}

export interface CoachMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  /** ISO timestamp. */
  createdAt: string;
  isError?: boolean;
  commandName?: string | null;
  modelUsed?: string;
  dataContext?: DataContextSummary | null;
  quotes?: StoredQuote[];
  attachments?: StoredAttachment[];
  proposals?: ProposalState[];
  notice?: string | null;
}

export const MAX_STORED_MESSAGES = 80;
const VERSION = 1;

export function storageKey(userId: string | null | undefined): string {
  return `fit-tracker:coach:v${VERSION}:${userId || "anonymous"}`;
}

function isMessage(value: unknown): value is CoachMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<CoachMessage>;
  return (
    typeof m.id === "string" &&
    (m.sender === "user" || m.sender === "assistant") &&
    typeof m.text === "string" &&
    typeof m.createdAt === "string"
  );
}

/** Parses stored history; anything malformed is dropped. A save that was in flight becomes pending again. */
export function parseStoredHistory(raw: string | null): CoachMessage[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { messages?: unknown };
    if (!Array.isArray(data?.messages)) return [];
    return data.messages.filter(isMessage).slice(-MAX_STORED_MESSAGES).map((message) => ({
      ...message,
      proposals: Array.isArray(message.proposals)
        ? message.proposals.map((p) => (p.status === "saving" ? { ...p, status: "pending" as const } : p))
        : undefined,
    }));
  } catch {
    return [];
  }
}

export function serializeHistory(messages: CoachMessage[]): string {
  return JSON.stringify({ messages: messages.slice(-MAX_STORED_MESSAGES) });
}

export function loadHistory(userId: string | null | undefined): CoachMessage[] {
  try {
    return parseStoredHistory(window.localStorage.getItem(storageKey(userId)));
  } catch {
    return [];
  }
}

export function saveHistory(userId: string | null | undefined, messages: CoachMessage[]): void {
  try {
    if (messages.length === 0) window.localStorage.removeItem(storageKey(userId));
    else window.localStorage.setItem(storageKey(userId), serializeHistory(messages));
  } catch {
    // Storage full or blocked: the chat still works for this visit.
  }
}

/** The last turns to send as context (errors and empty texts skipped). */
export function recentTurns(
  messages: CoachMessage[],
  maxTurns: number,
  maxChars: number
): Array<{ role: "user" | "assistant"; text: string }> {
  return messages
    .filter((m) => !m.isError && m.text.trim())
    .slice(-maxTurns)
    .map((m) => ({ role: m.sender, text: m.text.slice(0, maxChars) }));
}
