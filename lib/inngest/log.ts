/**
 * Thin wrapper around the job_logs table.
 *
 * Every Inngest function's onFailure hook calls writeJobLog so all failures
 * are visible in the admin Overview tab without relying on Inngest's own
 * dashboard.
 *
 * Informational events (e.g. no-items) can also be written with status='done'
 * so there's a complete audit trail even when nothing went wrong.
 */
import { createServiceClient } from "@/lib/supabase/service";

export type JobLogStatus = "queued" | "running" | "done" | "failed";

export interface WriteJobLogParams {
  jobName: string;
  status: JobLogStatus;
  userId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget: writes a job_log row.
 * Never throws — used inside onFailure hooks where a secondary failure must
 * not mask the original error.
 */
export async function writeJobLog({
  jobName,
  status,
  userId,
  error,
  metadata,
}: WriteJobLogParams): Promise<void> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    await supabase.from("job_logs").insert({
      job_name: jobName,
      status,
      user_id: userId ?? null,
      error: error ?? null,
      // Cast metadata: Supabase Json type doesn't accept Record<string,unknown> without help
      metadata: (metadata ?? {}) as unknown as import("@/types/database.types").Json,
      started_at: now,
      finished_at: now,
      created_at: now,
    });
  } catch (err) {
    // Must never throw — log to stderr only
    console.error("[writeJobLog] failed to write job log:", err);
  }
}
