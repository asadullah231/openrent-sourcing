import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Har request pe Supabase session refresh + poore dashboard ki hifazat.
 *
 * Car Arbitrage se farq: yahan "/" KHUD dashboard hai (naye listings), isliye wo
 * public NAHI hai. Bina login sirf /login aur /auth/* khulte hain.
 *
 * Ye zaroori hai kyunki /api/settings se bot ka mode 'live' kiya ja sakta hai —
 * yani khula chhorne ka matlab koi bhi landlords ko asli messages bhijwa sakta hai.
 */
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login";
  // /auth/callback = OAuth return — login se pehle hit hota hai, public rehna chahiye
  const isPublic = isAuthPage || path.startsWith("/auth/");

  // logged out + koi bhi dashboard page/API -> login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // logged in + login page -> dashboard (yahan "/" hi dashboard hai)
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
