"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Btn, Pill, Switch, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { usd } from "../components/studio";

interface BudgetSettings {
  weeklyCapUsd: number;
  monthlyPoolUsd: number;
  perOperatorWeeklyUsd: number;
  confirmThresholdUsd: number;
  noticePct: number;
  warnPct: number;
}

type FieldKind = "usd" | "pct";

interface FieldDef {
  key: keyof BudgetSettings;
  label: string;
  hint: string;
  kind: FieldKind;
  step: number;
}

interface FieldGroup {
  title: string;
  badge: string;
  blurb: string;
  fields: FieldDef[];
}

const GROUPS: FieldGroup[] = [
  {
    title: "Hard stops",
    badge: "⛔",
    blurb: "A job that doesn't fit is rejected at preflight — no override in chat.",
    fields: [
      {
        key: "weeklyCapUsd",
        label: "Shared weekly cap",
        hint: "Keeps one hot week from eating the month. Resets Monday 00:00 UTC.",
        kind: "usd",
        step: 0.25,
      },
      {
        key: "monthlyPoolUsd",
        label: "Monthly team pool",
        hint: "The number finance signs off on — hard stop for the whole team.",
        kind: "usd",
        step: 0.25,
      },
    ],
  },
  {
    title: "Soft signals",
    badge: "🎬",
    blurb: "Nudges, not walls. The confirm gate asks for one click; the per-operator guide only colours the banner.",
    fields: [
      {
        key: "confirmThresholdUsd",
        label: "Per-job confirm gate",
        hint: "Any single job above this needs an explicit 'spend it' click.",
        kind: "usd",
        step: 0.25,
      },
      {
        key: "perOperatorWeeklyUsd",
        label: "Per-operator weekly guide",
        hint: "Soft signal only — nudges an operator running hot, never blocks.",
        kind: "usd",
        step: 0.25,
      },
    ],
  },
  {
    title: "Thresholds",
    badge: "⚠️",
    blurb: "Where the banner turns. Stored as a fraction of a cap; shown here as a percentage.",
    fields: [
      {
        key: "noticePct",
        label: "Heads-up at",
        hint: "Fraction of a cap where the banner turns informational.",
        kind: "pct",
        step: 5,
      },
      {
        key: "warnPct",
        label: "Warning at",
        hint: "Fraction where the banner switches to \u201clock the shot, render once.\u201d",
        kind: "pct",
        step: 5,
      },
    ],
  },
];

/** Stored fraction (0–1) ⇄ percentage shown in the input. */
function toDisplay(kind: FieldKind, stored: number): number {
  return kind === "pct" ? Math.round(stored * 100) : stored;
}
function fromDisplay(kind: FieldKind, shown: number): number {
  return kind === "pct" ? shown / 100 : shown;
}

export default function SettingsPage() {
  const toast = useToast();
  const [budget, setBudget] = useState<BudgetSettings | null>(null);
  const [autoScore, setAutoScore] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [role, setRole] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setBudget(d.budget);
        setAutoScore(d.studio?.autoScore ?? false);
        setCanEdit(d.canEdit);
        setRole(d.role);
      })
      .catch(() => {});
  }, []);

  async function toggleAutoScore(next: boolean) {
    setAutoScore(next); // optimistic
    setSavingScore(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoScore: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAutoScore(data.studio?.autoScore ?? next);
      toast({
        kind: "ok",
        title: next ? "Auto-scoring on" : "Auto-scoring off",
        sub: next ? "Every render gets an AI fidelity score (~$0.002 each)" : "Renders won't be auto-rated",
      });
    } catch (err) {
      setAutoScore(!next); // revert
      toast({ kind: "bad", title: "Couldn't save", sub: err instanceof Error ? err.message : "Try again" });
    } finally {
      setSavingScore(false);
    }
  }

  const dirty = useMemo(
    () => Object.values(draft).some((v) => v !== ""),
    [draft]
  );

  async function save() {
    setBusy(true);
    try {
      // draft values are in *display* units (USD or whole percent); convert
      // percentages back to the 0–1 fraction the server stores.
      const patch: Record<string, number> = {};
      for (const group of GROUPS) {
        for (const f of group.fields) {
          const raw = draft[f.key];
          if (raw == null || raw === "" || !Number.isFinite(Number(raw))) continue;
          patch[f.key] = fromDisplay(f.kind, Number(raw));
        }
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBudget(data.budget);
      setDraft({});
      toast({ kind: "ok", title: "Caps saved", sub: "Live for every operator immediately" });
    } catch (err) {
      toast({
        kind: "bad",
        title: "Save failed",
        sub: err instanceof Error ? err.message : "Could not update caps",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-pad narrow">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Settings · Budget Law</p>
          <h1 className="t-h1">Spending guardrails</h1>
          <p className="t-body">
            Finance and admin govern the caps here. Everyone else sees the same numbers as
            banners and preflight gates while they work — chasing quality without doing mental
            accounting.
          </p>
        </div>
        <div className="actions">
          <Pill state={canEdit ? "approved" : "queued"} label={canEdit ? "Governor" : "Read-only"} />
        </div>
      </div>

      {!budget ? (
        <Card pad>
          <p className="t-sm muted">Loading guardrails…</p>
        </Card>
      ) : (
        <div className="col gap4">
          {!canEdit && (
            <Card pad style={{ borderColor: "var(--warn-line, var(--line-1))" }}>
              <div className="row gap2" style={{ alignItems: "flex-start" }}>
                <span style={{ color: "var(--warn-tx)", marginTop: 1 }}>
                  <Icon name="lock" size={16} />
                </span>
                <div className="grow">
                  <div className="t-sm" style={{ fontWeight: 600 }}>
                    Read-only — finance/admin can edit caps
                  </div>
                  <div className="t-xs muted" style={{ marginTop: 2 }}>
                    You&apos;re signed in as <strong>{role || "creative"}</strong>. Log out and pick
                    the finance or admin role to change governance.
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div className="card-hd">
              <span className="t-h3">Caps &amp; thresholds</span>
              <span className="t-xs muted">{canEdit ? "Editable" : "Effective values"}</span>
            </div>
            <div className="card-pad col gap4">
              {GROUPS.map((group) => (
                <div key={group.title} className="col gap2">
                  <div className="row gap2" style={{ alignItems: "baseline" }}>
                    <span className="t-label" style={{ margin: 0 }}>
                      {group.badge} {group.title}
                    </span>
                  </div>
                  <p className="t-xs muted" style={{ marginTop: -2 }}>
                    {group.blurb}
                  </p>
                  <div className="split even" style={{ marginTop: 4 }}>
                    {group.fields.map((f) => {
                      const display = toDisplay(f.kind, budget[f.key]);
                      const value = draft[f.key] ?? String(display);
                      const unit = f.kind === "pct" ? "%" : "$";
                      return (
                        <div key={f.key} className="col gap1">
                          <label className="field-label" htmlFor={f.key}>
                            {f.label}
                          </label>
                          <div
                            className="row"
                            style={{
                              alignItems: "center",
                              gap: 6,
                              border: "1px solid var(--line-1)",
                              borderRadius: "var(--r-md)",
                              padding: "0 10px",
                              background: "var(--bg-1)",
                            }}
                          >
                            {unit === "$" && (
                              <span className="mono t-sm muted" aria-hidden>
                                $
                              </span>
                            )}
                            <input
                              id={f.key}
                              className="input mono"
                              type="number"
                              step={f.step}
                              min={0}
                              max={f.kind === "pct" ? 100 : undefined}
                              disabled={!canEdit}
                              value={value}
                              onChange={(e) =>
                                setDraft((p) => ({ ...p, [f.key]: e.target.value }))
                              }
                              style={{ border: "none", background: "transparent", padding: "10px 0" }}
                            />
                            {unit === "%" && (
                              <span className="mono t-sm muted" aria-hidden>
                                %
                              </span>
                            )}
                          </div>
                          <span className="t-xs muted">{f.hint}</span>
                        </div>
                      );
                    })}
                  </div>
                  {group !== GROUPS[GROUPS.length - 1] && <div className="hr" />}
                </div>
              ))}

              {canEdit && (
                <>
                  <div className="hr" />
                  <div className="between wrap gap2">
                    <span className="t-xs muted">
                      Changes apply instantly to every operator&apos;s preflight and banners.
                    </span>
                    <Btn
                      variant="primary"
                      icon="shield"
                      onClick={save}
                      disabled={busy || !dirty}
                    >
                      {busy ? "Saving…" : "Save caps"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* quality & review */}
          <Card pad>
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div className="col gap1" style={{ minWidth: 0 }}>
                <span className="t-label" style={{ margin: 0 }}>🎯 Auto quality scoring</span>
                <p className="t-xs muted" style={{ marginTop: 4, maxWidth: 560 }}>
                  Rate every finished render against its prompt with a vision model — a 0–10 fidelity
                  score plus a one-line critique, shown on the gallery wall and in review. Costs about
                  <span className="mono"> $0.002</span> per render, so it&apos;s off by default.
                </p>
              </div>
              <label className="row gap2" style={{ alignItems: "center", flex: "none" }}>
                <span className="t-xs muted">{autoScore ? "On" : "Off"}</span>
                <Switch on={autoScore} onChange={canEdit && !savingScore ? toggleAutoScore : () => {}} />
              </label>
            </div>
            {!canEdit && (
              <p className="t-xs muted" style={{ marginTop: 8 }}>
                <Icon name="lock" size={11} /> Finance/admin can change this.
              </p>
            )}
          </Card>

          {/* current effective values, at a glance */}
          <Card pad>
            <span className="t-label">In effect right now</span>
            <div className="meta-rows mono" style={{ marginTop: 12 }}>
              <div className="meta-row">
                <span className="k">Weekly cap (hard stop)</span>
                <span>{usd(budget.weeklyCapUsd)}</span>
              </div>
              <div className="meta-row">
                <span className="k">Monthly pool (hard stop)</span>
                <span>{usd(budget.monthlyPoolUsd, 0)}</span>
              </div>
              <div className="meta-row">
                <span className="k">Per-job confirm gate</span>
                <span>{usd(budget.confirmThresholdUsd)}</span>
              </div>
              <div className="meta-row">
                <span className="k">Per-operator weekly guide</span>
                <span>{usd(budget.perOperatorWeeklyUsd)}</span>
              </div>
              <div className="meta-row">
                <span className="k">Heads-up / warning</span>
                <span>
                  {Math.round(budget.noticePct * 100)}% / {Math.round(budget.warnPct * 100)}%
                </span>
              </div>
            </div>
          </Card>

          {/* how the law behaves */}
          <Card pad>
            <span className="t-label">How the guardrails behave</span>
            <div className="col gap2" style={{ marginTop: 12 }}>
              <p className="t-sm" style={{ lineHeight: 1.6 }}>
                ⛔ <strong>Hard stops</strong> — the weekly cap and{" "}
                <span className="mono">$120</span> monthly pool. A job that doesn&apos;t fit is
                rejected at preflight; finance raises the ceiling here.
              </p>
              <p className="t-sm" style={{ lineHeight: 1.6 }}>
                🎬 <strong>Confirm gate</strong> — any single job over{" "}
                <span className="mono">$1.25</span> needs an explicit hold-to-commit before it
                spends.
              </p>
              <p className="t-sm" style={{ lineHeight: 1.6 }}>
                ⚠️ <strong>Soft signals</strong> — the per-operator weekly guide and the warn
                threshold switch the banner to &ldquo;lock the shot, render the keeper once.&rdquo;
                The pressure valve is fewer iterations, never a cheaper model.
              </p>
              <p className="t-sm muted" style={{ lineHeight: 1.6 }}>
                💰 Every spend lands in the ledger — the{" "}
                <a href="/costs" style={{ color: "var(--accent-hi)" }}>
                  Costs
                </a>{" "}
                page reconciles it against fal billing.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
