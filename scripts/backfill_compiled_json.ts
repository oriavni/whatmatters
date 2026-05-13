/**
 * One-shot backfill: populates compiled_json for a specific digest (or the
 * latest N digests per user) using the same buildCompiledDigest helper used
 * during generation.
 *
 * Usage:
 *   npx tsx scripts/backfill_compiled_json.ts [digestId]
 *   npx tsx scripts/backfill_compiled_json.ts  # backfills latest digest for all users
 */
import "dotenv/config";
import { createServiceClient } from "@/lib/supabase/service";
import { buildCompiledDigest } from "@/lib/digest/buildCompiledDigest";

async function main() {
  const db = createServiceClient();
  const targetDigestId = process.argv[2];

  let digestIds: string[] = [];

  if (targetDigestId) {
    digestIds = [targetDigestId];
    console.log(`Backfilling specific digest: ${targetDigestId}`);
  } else {
    // Find all sent/ready digests without compiled_json
    const { data, error } = await db
      .from("digests")
      .select("id")
      .in("status", ["ready", "sent"])
      .is("compiled_json", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    digestIds = (data ?? []).map((r) => r.id);
    console.log(`Found ${digestIds.length} digests without compiled_json`);
  }

  let success = 0;
  let failed = 0;

  for (const id of digestIds) {
    try {
      console.log(`  Building ${id}…`);
      const t0 = Date.now();
      const compiled = await buildCompiledDigest(id, db);
      const elapsed = Date.now() - t0;

      const { error: updateError } = await db
        .from("digests")
        .update({ compiled_json: compiled } as Record<string, unknown>)
        .eq("id", id);

      if (updateError) throw updateError;
      console.log(`  ✓ ${id} — ${compiled.clusters.length} clusters in ${elapsed}ms`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${id} — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
