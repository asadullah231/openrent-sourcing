"use client";

// Login — OpenRent dashboard ka darwaza.
// Yahan ke apne CSS vars use kiye hain; shadcn/sonner sirf Car Arbitrage me hai.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      </form>
    </div>
  );
}
