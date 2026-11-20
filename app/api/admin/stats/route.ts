import { route, ok } from "@/lib/api/route";
import { getAdminStats } from "@/lib/admin/stats";

export const GET = route({ auth: "admin" }, async ({ session }) =>
  ok(await getAdminStats({ timezone: session.timezone, weekStartDay: session.weekStartDay }))
);
