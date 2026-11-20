import mongoose, { Schema, Document, Model } from "mongoose";

interface IPlanMeal {
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout" | "post_workout";
  name: string;
  description: string;
  targetCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  order: number;
}

export interface INutritionPlan extends Document {
  name: string;
  description: string;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  meals: IPlanMeal[];
  assignedTo: mongoose.Types.ObjectId[];
  isPublic: boolean;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlanMealSchema = new Schema<IPlanMeal>(
  {
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"],
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    targetCalories: { type: Number, default: 0, min: 0, max: 5000 },
    macros: {
      protein: { type: Number, default: 0, min: 0 },
      carbs: { type: Number, default: 0, min: 0 },
      fat: { type: Number, default: 0, min: 0 },
      fiber: { type: Number, default: 0, min: 0 },
    },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const NutritionPlanSchema = new Schema<INutritionPlan>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    targetCalories: { type: Number, required: true, min: 800, max: 10_000 },
    targetProteinG: { type: Number, default: 0, min: 0 },
    targetCarbsG: { type: Number, default: 0, min: 0 },
    targetFatG: { type: Number, default: 0, min: 0 },
    meals: [PlanMealSchema],
    assignedTo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isPublic: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

NutritionPlanSchema.index({ createdBy: 1 });
NutritionPlanSchema.index({ isPublic: 1 });
NutritionPlanSchema.index({ assignedTo: 1 });

const NutritionPlan: Model<INutritionPlan> =
  mongoose.models.NutritionPlan ||
  mongoose.model<INutritionPlan>("NutritionPlan", NutritionPlanSchema);

export default NutritionPlan;

/**
 * The plan an admin assigned to this user (the most recently updated one when
 * there are several), or null. This is how the rest of the app reads plans.
 */
export async function findAssignedNutritionPlan(userId: string) {
  return NutritionPlan.findOne({ assignedTo: new mongoose.Types.ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .select("name description targetCalories targetProteinG targetCarbsG targetFatG meals updatedAt")
    .lean();
}
