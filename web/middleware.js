import { NextResponse } from "next/server";

/**
 * Dashboard KHULA hai — login nahi (client ka faisla, 22 Jul).
 *
 * Pehle poora dashboard Supabase auth ke peeche tha. Client ne kaha login ki
 * zaroorat nahi, bas frontend + backend chale. Isliye gate hata diya.
 *
 * ⚠️ LEKIN: bot ka `mode` (shadow/live) ab bhi khule API se badla ja sakta tha,
 * aur live mode me wo Mo ke asli OpenRent account se landlords ko viewing
 * requests bhejta hai. URL kisi ke haath lag jaye to wo Mo ka account
 * ban karwa sakta tha. Isliye mode-change ab API se hota hi nahi —
 * dekho app/api/settings/route.js. Baaki sab (listings, filters, settings)
 * khula hai.
 *
 * Login wapas chahiye ho to: git log me commit 35c46d2 aur c9fdddb —
 * middleware ka auth gate, /login page aur /auth/callback wahan mojood hain.
 */
export function middleware(request) {
  const path = request.nextUrl.pathname;

  // /login ab kuch nahi karta — purana bookmark ya redirect aaye to seedha dashboard.
  if (path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
