import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!password || password !== config.admin.secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_token", config.admin.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return response;
}
