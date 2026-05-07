/**
 * Cached server-side user lookup.
 *
 * Wrapping in React.cache() ensures that within a single server render
 * (one HTTP request), both layout.tsx and the active page component resolve
 * to the same Supabase Auth call — no duplicate network round-trips.
 *
 * Usage:
 *   import { getUser } from "@/lib/supabase/get-user";
 *   const user = await getUser(); // null if unauthenticated
 */
import { cache } from "react";
import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
