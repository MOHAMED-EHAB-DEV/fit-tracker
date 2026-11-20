import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import User from "@/lib/db/models/User";
import { badRequest, notFound } from "@/lib/api/errors";
import { escapeRegex, type NutritionPlanInput, type PlanListQuery } from "@/lib/validation/admin";

/** Nutrition plans: created by admins, assigned to users through `assignedTo`. */

export interface PlanUser {
  id: string;
  name: string;
  email: string;
}

export interface PlanMealDTO {
  mealType: string;
  name: string;
  description: string;
  targetCalories: number;
  macros: { protein: number; carbs: number; fat: number; fiber: number };
}

export interface AdminPlanDTO {
  id: string;
  name: string;
  description: string;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  meals: PlanMealDTO[];
  isPublic: boolean;
  assignedTo: PlanUser[];
  createdBy: PlanUser | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminPlanRow {
  id: string;
  name: string;
  description: string;
  targetCalories: number;
  targetProteinG: number;
  mealCount: number;
  assignedCount: number;
  isPublic: boolean;
  createdBy: PlanUser | null;
  createdAt: string | null;
}

interface PopulatedUser {
  _id: unknown;
  name?: string;
  email?: string;
}

interface PlanLean {
  _id: unknown;
  name: string;
  description?: string;
  targetCalories?: number;
  targetProteinG?: number;
  targetCarbsG?: number;
  targetFatG?: number;
  meals?: Array<Partial<PlanMealDTO> & { order?: number }>;
  isPublic?: boolean;
  assignedTo?: Array<PopulatedUser | null | unknown>;
  createdBy?: PopulatedUser | null | unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null);
const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function toPlanUser(value: unknown): PlanUser | null {
  if (!value || typeof value !== "object" || !("_id" in value)) return null;
  const user = value as PopulatedUser;
  if (!user.email && !user.name) return null;
  return { id: String(user._id), name: user.name || "", email: user.email || "" };
}

function toPlanDTO(plan: PlanLean): AdminPlanDTO {
  return {
    id: String(plan._id),
    name: plan.name,
    description: plan.description || "",
    targetCalories: n(plan.targetCalories),
    targetProteinG: n(plan.targetProteinG),
    targetCarbsG: n(plan.targetCarbsG),
    targetFatG: n(plan.targetFatG),
    meals: [...(plan.meals || [])]
      .sort((a, b) => n(a.order) - n(b.order))
      .map((meal) => ({
        mealType: meal.mealType || "breakfast",
        name: meal.name || "",
        description: meal.description || "",
        targetCalories: n(meal.targetCalories),
        macros: {
          protein: n(meal.macros?.protein),
          carbs: n(meal.macros?.carbs),
          fat: n(meal.macros?.fat),
          fiber: n(meal.macros?.fiber),
        },
      })),
    isPublic: Boolean(plan.isPublic),
    assignedTo: (plan.assignedTo || []).map(toPlanUser).filter((user): user is PlanUser => Boolean(user)),
    createdBy: toPlanUser(plan.createdBy),
    createdAt: iso(plan.createdAt),
    updatedAt: iso(plan.updatedAt),
  };
}

function planId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid plan id");
  return new mongoose.Types.ObjectId(id);
}

function persisted(input: NutritionPlanInput) {
  return { ...input, meals: input.meals.map((meal, order) => ({ ...meal, order })) };
}

export async function listPlans(query: PlanListQuery) {
  await getDb();
  const filter: Record<string, unknown> = {};
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), "i");
  if (query.isPublic) filter.isPublic = query.isPublic === "true";

  const direction = query.sortDir === "asc" ? 1 : -1;
  const [plans, total] = await Promise.all([
    NutritionPlan.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ [query.sortField]: direction, _id: direction })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("createdBy", "name email")
      .lean(),
    NutritionPlan.countDocuments(filter),
  ]);

  const rows: AdminPlanRow[] = (plans as unknown as PlanLean[]).map((plan) => ({
    id: String(plan._id),
    name: plan.name,
    description: plan.description || "",
    targetCalories: n(plan.targetCalories),
    targetProteinG: n(plan.targetProteinG),
    mealCount: plan.meals?.length ?? 0,
    assignedCount: plan.assignedTo?.length ?? 0,
    isPublic: Boolean(plan.isPublic),
    createdBy: toPlanUser(plan.createdBy),
    createdAt: iso(plan.createdAt),
  }));

  return {
    plans: rows,
    pagination: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function getPlan(id: string): Promise<AdminPlanDTO> {
  const _id = planId(id);
  await getDb();
  const plan = await NutritionPlan.findById(_id)
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();
  if (!plan) throw notFound("Nutrition plan not found");
  return toPlanDTO(plan as unknown as PlanLean);
}

export async function createPlan(adminId: string, input: NutritionPlanInput): Promise<AdminPlanDTO> {
  await getDb();
  const plan = await NutritionPlan.create({
    ...persisted(input),
    assignedTo: [],
    createdBy: new mongoose.Types.ObjectId(adminId),
  });
  return getPlan(String(plan._id));
}

export async function updatePlan(id: string, input: NutritionPlanInput): Promise<AdminPlanDTO> {
  const _id = planId(id);
  await getDb();
  const result = await NutritionPlan.updateOne({ _id }, { $set: persisted(input) }, { runValidators: true });
  if (result.matchedCount === 0) throw notFound("Nutrition plan not found");
  return getPlan(id);
}

export async function deletePlan(id: string): Promise<void> {
  const _id = planId(id);
  await getDb();
  const result = await NutritionPlan.deleteOne({ _id });
  if (result.deletedCount === 0) throw notFound("Nutrition plan not found");
}

/** Adds and removes users. Only existing accounts can be assigned. */
export async function updatePlanAssignees(id: string, add: string[], remove: string[]): Promise<AdminPlanDTO> {
  const _id = planId(id);
  await getDb();
  if (!(await NutritionPlan.exists({ _id }))) throw notFound("Nutrition plan not found");

  const addIds = Array.from(new Set(add)).map((value) => new mongoose.Types.ObjectId(value));
  if (addIds.length) {
    const found = await User.countDocuments({ _id: { $in: addIds } });
    if (found !== addIds.length) throw badRequest("One of the selected users no longer exists");
    await NutritionPlan.updateOne({ _id }, { $addToSet: { assignedTo: { $each: addIds } } });
  }
  const removeIds = Array.from(new Set(remove)).map((value) => new mongoose.Types.ObjectId(value));
  if (removeIds.length) {
    await NutritionPlan.updateOne({ _id }, { $pull: { assignedTo: { $in: removeIds } } });
  }
  return getPlan(id);
}
