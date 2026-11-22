import React from "react";
import { requireAdminPage } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AdminZoneProvider } from "@/components/admin/AdminZone";
import { resolveTimeZone } from "@/lib/time";

export const metadata = {
  title: { default: "Admin Panel", template: "%s | Admin Panel" },
};

/**
 * Signed-out visitors go to the login page; signed-in non-admins go home.
 * Every page below repeats the check itself before reading any data.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const adminName = admin.name || "Admin";
  const adminEmail = admin.email || "";
  const timeZone = resolveTimeZone(admin.preferences?.timezone);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink antialiased md:flex-row">
      <AdminMobileNav adminName={adminName} adminEmail={adminEmail} />
      <AdminSidebar adminName={adminName} adminEmail={adminEmail} />
      <main className="flex min-w-0 flex-1 flex-col md:h-dvh md:overflow-y-auto">
        <div className="w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          <AdminZoneProvider timeZone={timeZone}>{children}</AdminZoneProvider>
        </div>
      </main>
    </div>
  );
}
