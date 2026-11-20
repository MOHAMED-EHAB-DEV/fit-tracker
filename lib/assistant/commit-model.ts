import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * One row per confirmed assistant log, keyed by the client's commit id.
 * `targetId` is the id given to whatever the commit creates, so a retry
 * finds the same document instead of creating a second one.
 */
export interface IAssistantCommit {
  userId: Types.ObjectId;
  commitId: string;
  kind: "meal" | "water" | "steps" | "weight";
  targetId: Types.ObjectId;
  status: "pending" | "done";
  createdAt: Date;
  updatedAt: Date;
}

const AssistantCommitSchema = new Schema<IAssistantCommit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    commitId: { type: String, required: true, maxlength: 64 },
    kind: { type: String, enum: ["meal", "water", "steps", "weight"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ["pending", "done"], default: "pending" },
  },
  { timestamps: true }
);

AssistantCommitSchema.index({ userId: 1, commitId: 1 }, { unique: true });
// Retries happen within minutes; keep the keys for a week.
AssistantCommitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const AssistantCommit: Model<IAssistantCommit> =
  mongoose.models.AssistantCommit || mongoose.model<IAssistantCommit>("AssistantCommit", AssistantCommitSchema);

export default AssistantCommit;
