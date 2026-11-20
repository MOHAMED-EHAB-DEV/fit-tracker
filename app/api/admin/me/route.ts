import { route, ok } from "@/lib/api/route";

export const GET = route({ auth: "admin" }, async ({ session }) =>
  ok({
    isAdmin: true,
    user: { id: session.userId, name: session.name, email: session.email, role: session.role },
  })
);
