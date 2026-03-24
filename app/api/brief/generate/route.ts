import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";

/** POST /api/brief/generate — trigger on-demand digest generation */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Guard: no duplicate concurrent generations for the same user
  const { data: inProgress } = await service
    .from("digests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "generating"])
    .limit(1)
    .maybeSingle();

  if (inProgress) {
    return NextResponse.json(
      { error: "A brief is already being generated", digest_id: inProgress.id },
      { status: 409 }
    );
  }

  // Fire the Inngest digest generation event.
  // The function creates the digest row and handles the full pipeline.
  await inngest.send({
    name: "digest/generate",
    data: { user_id: user.id },
  });

  return NextResponse.json({ status: "generating" });
}
