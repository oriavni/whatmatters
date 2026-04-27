import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUserPremium } from "@/lib/audio/premium";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppClientLayout } from "@/components/layout/AppClientLayout";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: proxy.ts handles the redirect for unauthenticated users, but we
  // also check here so server components always have a confirmed user object.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch premium status for sidebar pricing clarity.
  // Non-blocking: defaults to false on error so layout never breaks.
  const isPremium = await isUserPremium(user.id).catch(() => false);

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email ?? ""} isPremium={isPremium} />
      <SidebarInset>
        <AppHeader />
        <AppClientLayout>
          <main className="flex-1 p-6 pb-24">{children}</main>
        </AppClientLayout>
      </SidebarInset>
    </SidebarProvider>
  );
}
