import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { inngest } from "@/lib/inngest/client";

function isAuthorized(request: NextRequest): boolean {
  const token = request.cookies.get("admin_token")?.value;
  return !!token && token === config.admin.secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user_id } = await request.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  await inngest.send({ name: "digest/generate", data: { user_id } });
  return NextResponse.json({ ok: true });
}
