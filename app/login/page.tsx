"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPERATORS = ["Eppi", "Teammate 1", "Teammate 2", "Guest"];

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [operator, setOperator] = useState(OPERATORS[0]);
  const [customOperator, setCustomOperator] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const name = operator === "custom" ? customOperator : operator;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, operator: name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Login failed");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>StudioCreation</h1>
      <p className="subtitle">Team access — shared studio password.</p>
      <form className="panel" onSubmit={submit}>
        <label htmlFor="password">Studio password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <div style={{ marginTop: 16 }}>
          <label htmlFor="operator">Operator</label>
          <select id="operator" value={operator} onChange={(e) => setOperator(e.target.value)}>
            {OPERATORS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="custom">Other…</option>
          </select>
          {operator === "custom" && (
            <input
              style={{ marginTop: 8 }}
              placeholder="Your name"
              value={customOperator}
              onChange={(e) => setCustomOperator(e.target.value)}
            />
          )}
        </div>
        <div className="row">
          <span className="estimate">Every job is logged under your operator name.</span>
          <button type="submit" disabled={busy || !password}>
            {busy ? "Checking…" : "Enter studio"}
          </button>
        </div>
        {error && <p className="error">⚠️ {error}</p>}
      </form>
    </main>
  );
}
