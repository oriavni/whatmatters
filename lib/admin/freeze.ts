/**
 * Account freeze helper.
 *
 * Uses a type cast because the `is_frozen` column is added by migration
 * 20260427000002 and the generated Supabase types will not reflect it until
 * `supabase gen types` is re-run after that migration is applied.
 *
 * All enforcement points (API routes, Inngest functions) call isUserFrozen()
 * so the cast is confined to one place.
 */
import { createServiceClient } from "@/lib/supabase/service";

type FrozenRow = { is_frozen: boolean } | null;

export async function isUserFrozen(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await (
    supabase
      .from("users")
      .select("is_frozen")
      .eq("id", userId)
      .single() as unknown as Promise<{ data: FrozenRow; error: unknown }>
  );
  return data?.is_frozen === true;
}
