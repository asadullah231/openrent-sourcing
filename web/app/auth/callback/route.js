import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth ki wapsi: Supabase yahan ?code= ke sath bhejta hai.
 * Code ko session me badlo (cookies set hoti hain) -> dashboard.
 *
 * Car Arbitrage se farq: yahan "/" hi dashboard hai, /dashboard nahi.
 * Allowlist check middleware me hai — is liye yahan sirf session banate hain;
 * ghair-mansoob email login to ho jayegi magar middleware foran bahar phenk dega.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
