import mongoose from "mongoose";
import { route, ok, badRequest, notFound } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import { recomputeDay } from "@/lib/fitness/daily-log";
import { adminMealPatchSchema } from "@/lib/validation/admin";

type Params = { id: string };

function mealId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid meal id");
  return new mongoose.Types.ObjectId(id);
}

/** Corrects a meal. The day's totals are rebuilt from the meals afterwards. */
export const PATCH = route<typeof adminMealPatchSchema._output, undefined, Params>(
  { auth: "admin", body: adminMealPatchSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params, body }) => {
    await getDb();
    const set: Record<string, unknown> = {};
    if (body.mealType !== undefined) set.mealType = body.mealType;
    if (body.description !== undefined) set.description = body.description;
    if (body.macros) {
      set.macros = body.macros;
      set.isManualOverride = true;
    }
    const meal = await Meal.findOneAndUpdate({ _id: mealId(params.id) }, { $set: set }, {
      returnDocument: "after",
      runValidators: true,
    })
      .select("userId mealType description dateString macros isManualOverride")
      .lean();
    if (!meal) throw notFound("Meal not found");
    await recomputeDay(String(meal.userId), meal.dateString);
    return ok({ meal });
  }
);

export const DELETE = route<undefined, undefined, Params>(
  { auth: "admin", rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params }) => {
    await getDb();
    const meal = await Meal.findOneAndDelete({ _id: mealId(params.id) }).lean();
    if (!meal) throw notFound("Meal not found");
    await recomputeDay(String(meal.userId), meal.dateString);

    // Same rule as a user deleting their meal: only the owner's own photos (or
    // old shared ones nobody else uses) are destroyed.
    let photosNotRemoved = 0;
    if ((meal.images || []).length) {
      const { destroyMealImages } = await import("@/lib/nutrition/images");
      photosNotRemoved = (await destroyMealImages(String(meal.userId), meal.images, String(meal._id))).failed;
    }
    return ok({
      message: photosNotRemoved
        ? `Meal deleted. ${photosNotRemoved} photo(s) could not be removed from storage.`
        : "Meal deleted",
    });
  }
);
