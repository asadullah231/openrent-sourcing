"use client";

// Login — OpenRent dashboard ka darwaza.
// Yahan ke apne CSS vars use kiye hain; shadcn/sonner sirf Car Arbitrage me hai.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// useSearchParams ko Next 15 me Suspense chahiye, warna prerender pe build fail hota hai.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // middleware/callback ?error= ke sath wapas bhejte hain — wajah batana zaroori hai,
  // warna user ko chup-chaap login pe phenk diya jata hai aur samajh nahi aata kyun.
  useEffect(() => {
    const e = params.get("error");
    if (e === "not_allowed") setError("This Google account does not have access.");
    else if (e === "oauth") setError("Google sign-in failed. Try again.");
  }, [params]);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // error na ho to browser Google pe chala jata hai — yahan wapas nahi aata
    if (error) {
      setGoogleLoading(false);
      setError(error.message || "Google sign-in failed");
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message || "Login failed");
      return;
    }
    router.push("/"); // yahan "/" hi dashboard hai
    router.refresh();
  }

  const field = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--mist-line)", background: "var(--ink-raise)",
    color: "inherit", fontSize: 14, marginTop: 6,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%", maxWidth: 360, padding: 28, borderRadius: 12,
          border: "1px solid var(--mist-line)", background: "var(--ink-raise)",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>OpenRent Sourcing</h1>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 22 }}>
          Sign in to continue.
        </p>

        <label style={{ fontSize: 12.5, display: "block", marginBottom: 14 }}>
          Email
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" style={field}
          />
        </label>

        <label style={{ fontSize: 12.5, display: "block", marginBottom: 20 }}>
          Password
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="current-password" style={field}
          />
        </label>

        {error && (
          <p style={{ color: "var(--rust)", fontSize: 12.5, marginBottom: 14 }}>{error}</p>
        )}

        <button
          type="submit" disabled={loading}
          style={{
            width: "100%", padding: "11px 12px", borderRadius: 8, border: "none",
            background: "var(--rust)", color: "#fff", fontSize: 14,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <span style={{ flex: 1, height: 1, background: "var(--mist-line)" }} />
          <span className="text-muted" style={{ fontSize: 11.5 }}>or</span>
          <span style={{ flex: 1, height: 1, background: "var(--mist-line)" }} />
        </div>

        <button
          type="button" onClick={signInWithGoogle} disabled={googleLoading}
          style={{
            width: "100%", padding: "11px 12px", borderRadius: 8,
            border: "1px solid var(--mist-line)", background: "transparent",
            color: "inherit", fontSize: 14, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 9,
            cursor: googleLoading ? "default" : "pointer", opacity: googleLoading ? 0.7 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/>
            <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/>
            <path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.7H4.3C2.8 17.2 2 20.5 2 24s.8 6.8 2.3 9.8l7.4-5.7z"/>
            <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.4 5.7c1.7-5.2 6.6-9.1 12.3-9.1z"/>
          </svg>
          {googleLoading ? "Opening Google…" : "Sign in with Google"}
        </button>
      </form>
    </div>
  );
}
