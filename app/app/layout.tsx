import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { isAudioPremium } from "@/lib/audio/premium";
import { createServiceClient } from "@/lib/supabase/service";
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
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch premium status + actual plan name for sidebar display.
  // Non-blocking: defaults on error so layout never breaks.
  const db = createServiceClient();
  const [isPremium, subRow] = await Promise.all([
    isAudioPremium(user.id).catch(() => false),
    db.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data, () => null),
  ]);
  const planLabel = (subRow?.plan as string | null) ?? "free";

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email ?? ""} isPremium={isPremium} plan={planLabel} />
      <SidebarInset>
        <AppHeader />
        <AppClientLayout>
          <main className="flex-1 p-6 pb-24">{children}</main>
        </AppClientLayout>
      </SidebarInset>
    </SidebarProvider>
  );
}
