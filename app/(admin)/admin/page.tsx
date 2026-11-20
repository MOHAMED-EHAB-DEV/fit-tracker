import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin";

export default async function AdminRootPage() {
  await requireAdminPage();
  redirect("/admin/dashboard");
}
