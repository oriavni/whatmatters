import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/service";

function isAuthorized(request: NextRequest): boolean {
  const token = request.cookies.get("admin_token")?.value;
  return !!token && token === config.admin.secret;
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user_id, plan } = await request.json();
  if (!user_id || !plan) {
    return NextResponse.json({ error: "user_id and plan required" }, { status: 400 });
  }

  const validPlans = ["free", "pro", "lifetime"];
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ plan })
    .eq("user_id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
