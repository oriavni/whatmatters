/**
 * Supabase middleware helper.
 * Called from proxy.ts to refresh session cookies on every request.
 *
 * Uses literal process.env accesses (not config.ts) because this file runs
 * in the Next.js Edge runtime, which shares the same static-inlining rules
 * as the browser bundle for NEXT_PUBLIC_* variables.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — do not add any logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  const url = request.nextUrl.clone();
  const isAppRoute = url.pathname.startsWith("/app");
  const isAdminRoute = url.pathname.startsWith("/admin");
  const isAuthRoute =
    url.pathname.startsWith("/login") || url.pathname.startsWith("/signup");

  if (!user && (isAppRoute || isAdminRoute)) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    url.pathname = "/app/brief";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
