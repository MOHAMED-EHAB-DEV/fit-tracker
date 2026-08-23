import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

export const metadata = {
  title: { default: "Admin Panel", template: "%s | Admin Panel" },
};

async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/login");
  }

  const adminName = String((admin as any).name ?? "Admin");
  const adminEmail = String((admin as any).email ?? "");

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <AdminMobileNav adminName={adminName} adminEmail={adminEmail} />
      <AdminSidebar adminName={adminName} adminEmail={adminEmail} />
      <main className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto">
        <div className="w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
