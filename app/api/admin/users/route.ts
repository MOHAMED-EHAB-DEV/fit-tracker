import { route, ok } from "@/lib/api/route";
import { userListQuery } from "@/lib/validation/admin";
import { listAdminUsers } from "@/lib/admin/users";

export const GET = route({ auth: "admin", query: userListQuery }, async ({ query }) => ok(await listAdminUsers(query)));
