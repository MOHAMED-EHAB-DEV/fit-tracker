import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { adminUserPatchSchema, type AdminUserPatch } from "@/lib/validation/admin";
import { deleteUserAsAdmin, getAdminUserDetail, updateUserAsAdmin } from "@/lib/admin/users";

type Params = { id: string };

export const GET = route<undefined, undefined, Params>({ auth: "admin" }, async ({ session, params }) =>
  ok(await getAdminUserDetail(session.userId, params.id))
);

/**
 * Role, ban and profile changes. Admins cannot change their own role or ban
 * themselves, and the last admin who can sign in cannot be demoted or banned.
 */
export const PATCH = route<AdminUserPatch, undefined, Params>(
  { auth: "admin", body: adminUserPatchSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params, body }) => ok(await updateUserAsAdmin(session.userId, params.id, body))
);

/** Deletes the account and everything it owns (see lib/admin/delete-user.ts). */
export const DELETE = route<undefined, undefined, Params>(
  { auth: "admin", rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    const report = await deleteUserAsAdmin(session.userId, params.id);
    const failed = report.assets.failed.length;
    return ok({
      deleted: report.deleted,
      assets: report.assets,
      message: failed
        ? `The account and its data were deleted, but ${failed} of ${report.assets.total} photos could not be removed from Cloudinary. They are listed in the server log.`
        : "The account and all of its data were deleted.",
    });
  }
);
