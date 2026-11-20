/**
 * Which Cloudinary assets belong to which user's meals. Pure, so it can be
 * tested without the SDK.
 *
 * New uploads live in "fit-tracker/meals/<userId>/<asset>". Meals saved before
 * per-user folders used the shared "fit-tracker/meals/<asset>" folder; those may
 * still be destroyed, but nothing outside the meals folder ever can be.
 */
export const MEAL_IMAGE_ROOT = "fit-tracker/meals";

const USER_ID_RE = /^[a-f\d]{24}$/i;
const ASSET_NAME_RE = /^[A-Za-z0-9_-]{1,200}$/;

export function mealImageFolder(userId: string): string {
  if (!USER_ID_RE.test(userId)) throw new Error("Invalid user id for image folder");
  return `${MEAL_IMAGE_ROOT}/${userId.toLowerCase()}`;
}

/** An asset inside the user's own meal folder. */
export function isOwnedMealImage(publicId: unknown, userId: string): boolean {
  if (typeof publicId !== "string" || !USER_ID_RE.test(userId)) return false;
  const prefix = `${MEAL_IMAGE_ROOT}/${userId.toLowerCase()}/`;
  if (!publicId.startsWith(prefix)) return false;
  return ASSET_NAME_RE.test(publicId.slice(prefix.length));
}

/** An asset directly inside the old shared meals folder (no sub-folder). */
export function isLegacySharedMealImage(publicId: unknown): boolean {
  if (typeof publicId !== "string") return false;
  const prefix = `${MEAL_IMAGE_ROOT}/`;
  if (!publicId.startsWith(prefix)) return false;
  return ASSET_NAME_RE.test(publicId.slice(prefix.length));
}

/** The only assets a user's meal operations may read back or destroy. */
export function canTouchMealImage(publicId: unknown, userId: string): boolean {
  return isOwnedMealImage(publicId, userId) || isLegacySharedMealImage(publicId);
}
