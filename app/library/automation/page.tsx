"use client";

/* ===================================================================
   AUTOMATION RULES — the job-queue automation surface for the Media
   Library. A rule is: trigger (event | schedule | manual) → conditions
   (ALL must match) → ordered steps (queue jobs / inline actions).

   This page lists rules with an enable toggle, trigger badge, condition
   chips and a step flow, plus run/edit/delete actions. The editor panel
   builds the exact JSON shapes the /api/library/automation contract
   expects and posts create/update. Shares the Portal One design system
   with the sibling Media Library page.
   =================================================================== */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "../../components/Icon";
import styles from "./automation.module.css";

// ── contract types (mirror studiolibrary/lib/automation) ─────────────
type TriggerType = "event" | "schedule" | "manual";
type CondField = "kind" | "path" | "review_state";
type CondOp = "eq" | "in" | "glob";
type StepAction = "proxy" | "transcribe" | "embed" | "tag" | "notify" | "rescan";

interface RuleCondition {
  field: CondField;
  op: CondOp;
  value: string | string[];
}
interface RuleStep {
  action: StepAction;
  params?: Record<string, unknown>;
  runOn?: "success" | "always";
}
interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  trigger_type: TriggerType;
  event: string | null;
  cron: string | null;
  conditions: RuleCondition[];
  steps: RuleStep[];
  last_run_at: string | null;
  runs: number;
  created_at: string;
}

// ── editor-local draft shapes (string-only fields, easy to bind) ─────
interface DraftCondition { field: CondField; op: CondOp; value: string }
interface DraftStep { action: StepAction; param: string }
interface Draft {
  id: number | null; // null → new rule
  name: string;
  trigger_type: TriggerType;
  event: string;
  cron: string;
  conditions: DraftCondition[];
  steps: DraftStep[];
}

const EVENTS = [
  "asset.created",
  "asset.state_changed",
  "proxy.failed",
  "transcribe.completed",
] as const;

const COND_FIELDS: { value: CondField; label: string }[] = [
  { value: "kind", label: "kind" },
  { value: "path", label: "path" },
  { value: "review_state", label: "review_state" },
];
const COND_OPS: { value: CondOp; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "in", label: "in" },
  { value: "glob", label: "glob" },
];
const OP_SYMBOL: Record<CondOp, string> = { eq: "=", in: "in", glob: "glob" };

const STEP_ACTIONS: StepAction[] = ["proxy", "transcribe", "embed", "tag", "notify", "rescan"];
const STEP_ICON: Record<StepAction, string> = {
  proxy: "film",
  transcribe: "captions",
  embed: "spark",
  tag: "layers",
  notify: "bell",
  rescan: "refresh",
};

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Every night 02:00", value: "0 2 * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Every 15 min", value: "*/15 * * * *" },
];

// ── helpers ──────────────────────────────────────────────────────────
function relTime(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

function condText(c: RuleCondition): string {
  const v = Array.isArray(c.value) ? c.value.join(", ") : c.value;
  return `${c.field} ${OP_SYMBOL[c.op] ?? c.op} ${v}`;
}

/** A blank draft for "New rule". */
function emptyDraft(): Draft {
  return {
    id: null,
    name: "",
    trigger_type: "event",
    event: EVENTS[0],
    cron: "",
    conditions: [],
    steps: [{ action: "proxy", param: "" }],
  };
}

/** Hydrate the editor from an existing rule. */
function draftFromRule(r: AutomationRule): Draft {
  return {
    id: r.id,
    name: r.name,
    trigger_type: r.trigger_type,
    event: r.event ?? EVENTS[0],
    cron: r.cron ?? "",
    conditions: (r.conditions ?? []).map((c) => ({
      field: c.field,
      op: c.op,
      value: Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? ""),
    })),
    steps: (r.steps ?? []).map((s) => ({
      action: s.action,
      param:
        s.action === "tag"
          ? String(s.params?.label ?? "")
          : s.action === "notify"
            ? String(s.params?.message ?? "")
            : "",
    })),
  };
}

/** Compile the editor draft into the JSON shape the API expects. */
function compileDraft(d: Draft): Omit<AutomationRule, "id" | "last_run_at" | "runs" | "created_at"> {
  const conditions: RuleCondition[] = d.conditions
    .filter((c) => c.value.trim() !== "")
    .map((c) => ({
      field: c.field,
      op: c.op,
      value:
        c.op === "in"
          ? c.value.split(",").map((s) => s.trim()).filter(Boolean)
          : c.value.trim(),
    }));

  const steps: RuleStep[] = d.steps.map((s) => {
    const step: RuleStep = { action: s.action };
    if (s.action === "tag" && s.param.trim()) step.params = { label: s.param.trim() };
    else if (s.action === "notify" && s.param.trim()) step.params = { message: s.param.trim() };
    return step;
  });

  return {
    name: d.name.trim() || "New rule",
    enabled: true,
    trigger_type: d.trigger_type,
    event: d.trigger_type === "event" ? d.event : null,
    cron: d.trigger_type === "schedule" ? d.cron.trim() : null,
    conditions,
    steps,
  };
}

// ── page ─────────────────────────────────────────────────────────────
export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null); // rule id mid-write
  const [draft, setDraft] = useState<Draft | null>(null); // open editor
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/library/automation");
      const d: { rules?: AutomationRule[] } = await r.json();
      setRules(d.rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── write ops ──────────────────────────────────────────────────────
  const post = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/library/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json() as Promise<Record<string, unknown>>;
  }, []);

  const toggleRule = useCallback(async (rule: AutomationRule) => {
    setBusy(rule.id);
    try {
      await post({ action: "toggle", id: rule.id, enabled: !rule.enabled });
      await load();
    } finally {
      setBusy(null);
    }
  }, [post, load]);

  const runRule = useCallback(async (rule: AutomationRule) => {
    setBusy(rule.id);
    try {
      await post({ action: "run", id: rule.id, assetIds: [] });
      await load();
    } finally {
      setBusy(null);
    }
  }, [post, load]);

  const deleteRule = useCallback(async (rule: AutomationRule) => {
    if (!window.confirm(`Delete the rule “${rule.name}”? This can’t be undone.`)) return;
    setBusy(rule.id);
    try {
      await post({ action: "delete", id: rule.id });
      await load();
    } finally {
      setBusy(null);
    }
  }, [post, load]);

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const rule = compileDraft(draft);
      if (draft.id == null) await post({ action: "create", rule });
      else await post({ action: "update", id: draft.id, rule });
      setDraft(null);
      await load();
    } finally {
      setSaving(false);
    }
  }, [draft, post, load]);

  const enabledCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  return (
    <div className={styles.wrap}>
      {/* ── header ─────────────────────────────────────────────────── */}
      <div className={styles.head}>
        <div>
          <Link href="/library" className={styles.back}>
            <Icon name="chevronRight" size={14} className={styles.backChevron} />
            Media Library
          </Link>
          <div className={styles.title}>Automation · rules</div>
          <div className={styles.count}>
            {loading ? "—" : rules.length}
            <small>
              rule{rules.length === 1 ? "" : "s"}
              {!loading && rules.length > 0 ? ` · ${enabledCount} enabled` : ""}
            </small>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => setDraft(emptyDraft())}>
          <Icon name="create" size={15} /> New rule
        </button>
      </div>

      {/* ── rules list ─────────────────────────────────────────────── */}
      {loading ? (
        <div className={styles.empty}>Loading rules…</div>
      ) : rules.length === 0 ? (
        <div className={styles.empty}>
          <p>No automation rules yet.</p>
          <p className={styles.emptyHint}>
            A rule reacts to events, a schedule or a manual run — then enqueues
            jobs like <code>proxy</code> or <code>transcribe</code>.
          </p>
          <button className={styles.newBtnGhost} onClick={() => setDraft(emptyDraft())}>
            <Icon name="create" size={14} /> Create the first rule
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              busy={busy === rule.id}
              onToggle={() => toggleRule(rule)}
              onRun={() => runRule(rule)}
              onEdit={() => setDraft(draftFromRule(rule))}
              onDelete={() => deleteRule(rule)}
            />
          ))}
        </div>
      )}

      {/* ── editor panel ───────────────────────────────────────────── */}
      {draft && (
        <RuleEditor
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}
    </div>
  );
}

// ── rule row ─────────────────────────────────────────────────────────
function RuleRow({
  rule, busy, onToggle, onRun, onEdit, onDelete,
}: {
  rule: AutomationRule;
  busy: boolean;
  onToggle: () => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const conds = rule.conditions ?? [];
  const steps = rule.steps ?? [];
  return (
    <div className={`${styles.row} ${rule.enabled ? "" : styles.rowOff}`}>
      {/* enable toggle */}
      <button
        className={`${styles.toggle} ${rule.enabled ? styles.toggleOn : ""}`}
        onClick={onToggle}
        disabled={busy}
        role="switch"
        aria-checked={rule.enabled}
        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
        title={rule.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
      >
        <span className={styles.toggleKnob} />
      </button>

      {/* main */}
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          <span className={styles.name}>{rule.name}</span>
          <TriggerBadge rule={rule} />
        </div>

        {/* conditions */}
        <div className={styles.chipRow}>
          {conds.length === 0 ? (
            <span className={`${styles.chip} ${styles.chipMuted}`}>any asset</span>
          ) : (
            conds.map((c, i) => (
              <span key={i} className={styles.chip}>{condText(c)}</span>
            ))
          )}
        </div>

        {/* steps */}
        <div className={styles.flow}>
          {steps.length === 0 ? (
            <span className={styles.flowEmpty}>no steps</span>
          ) : (
            steps.map((s, i) => (
              <span key={i} className={styles.flowItem}>
                {i > 0 && <Icon name="arrowRight" size={13} className={styles.flowArrow} />}
                <span className={styles.actionChip}>
                  <Icon name={STEP_ICON[s.action] ?? "spark"} size={12} />
                  {s.action}
                </span>
              </span>
            ))
          )}
        </div>

        {/* meta */}
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <Icon name="refresh" size={12} /> {rule.runs} run{rule.runs === 1 ? "" : "s"}
          </span>
          <span className={styles.metaItem}>
            <Icon name="clock" size={12} /> {relTime(rule.last_run_at)}
          </span>
        </div>
      </div>

      {/* actions */}
      <div className={styles.rowActions}>
        <button className={styles.actBtn} onClick={onRun} disabled={busy} title="Run now">
          <Icon name="play" size={13} /> Run now
        </button>
        <button className={styles.actBtn} onClick={onEdit} disabled={busy} title="Edit rule">
          <Icon name="tools" size={13} /> Edit
        </button>
        <button
          className={`${styles.actBtn} ${styles.actDanger}`}
          onClick={onDelete}
          disabled={busy}
          title="Delete rule"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}

function TriggerBadge({ rule }: { rule: AutomationRule }) {
  if (rule.trigger_type === "event") {
    return (
      <span className={`${styles.trigBadge} ${styles.trigEvent}`}>
        <Icon name="spark" size={11} /> {rule.event ?? "event"}
      </span>
    );
  }
  if (rule.trigger_type === "schedule") {
    return (
      <span className={`${styles.trigBadge} ${styles.trigSchedule}`}>
        <Icon name="clock" size={11} /> <span className="mono">{rule.cron ?? "cron"}</span>
      </span>
    );
  }
  return (
    <span className={`${styles.trigBadge} ${styles.trigManual}`}>
      <Icon name="play" size={11} /> manual
    </span>
  );
}

// ── editor ───────────────────────────────────────────────────────────
function RuleEditor({
  draft, setDraft, saving, onSave, onCancel,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  // Narrowed setter that operates on the current (non-null) draft.
  const patch = useCallback(
    (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d)),
    [setDraft]
  );

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // ── conditions ──
  const addCondition = () =>
    patch({ conditions: [...draft.conditions, { field: "kind", op: "eq", value: "" }] });
  const updateCondition = (i: number, p: Partial<DraftCondition>) =>
    patch({ conditions: draft.conditions.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const removeCondition = (i: number) =>
    patch({ conditions: draft.conditions.filter((_, j) => j !== i) });

  // ── steps ──
  const addStep = () => patch({ steps: [...draft.steps, { action: "proxy", param: "" }] });
  const updateStep = (i: number, p: Partial<DraftStep>) =>
    patch({ steps: draft.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const removeStep = (i: number) => patch({ steps: draft.steps.filter((_, j) => j !== i) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.steps.length) return;
    const next = [...draft.steps];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ steps: next });
  };

  const canSave = draft.name.trim() !== "" && draft.steps.length > 0 &&
    (draft.trigger_type !== "schedule" || draft.cron.trim() !== "");

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={draft.id == null ? "New rule" : "Edit rule"}
      >
        <div className={styles.panelHd}>
          <span className={styles.panelTitle}>
            {draft.id == null ? "New rule" : "Edit rule"}
          </span>
          <button className={styles.iconBtn} onClick={onCancel} aria-label="Close editor">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className={styles.panelBody}>
          {/* name */}
          <label className={styles.field}>
            <span className={styles.fieldLbl}>Name</span>
            <input
              className={styles.input}
              value={draft.name}
              placeholder="e.g. Proxy raw footage"
              onChange={(e) => patch({ name: e.target.value })}
              autoFocus
            />
          </label>

          {/* trigger */}
          <div className={styles.field}>
            <span className={styles.fieldLbl}>Trigger</span>
            <div className={styles.segmented}>
              {(["event", "schedule", "manual"] as TriggerType[]).map((t) => (
                <button
                  key={t}
                  className={`${styles.segBtn} ${draft.trigger_type === t ? styles.segOn : ""}`}
                  onClick={() => patch({ trigger_type: t })}
                >
                  {t === "event" ? "Event" : t === "schedule" ? "Schedule" : "Manual"}
                </button>
              ))}
            </div>

            {draft.trigger_type === "event" && (
              <select
                className={styles.select}
                value={draft.event}
                onChange={(e) => patch({ event: e.target.value })}
              >
                {EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            )}

            {draft.trigger_type === "schedule" && (
              <div className={styles.cronBox}>
                <div className={styles.presets}>
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      className={`${styles.preset} ${draft.cron.trim() === p.value ? styles.presetOn : ""}`}
                      onClick={() => patch({ cron: p.value })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  className={`${styles.input} mono`}
                  value={draft.cron}
                  placeholder="0 2 * * *"
                  onChange={(e) => patch({ cron: e.target.value })}
                />
                <span className={styles.hint}>minute hour day month weekday (local time)</span>
              </div>
            )}

            {draft.trigger_type === "manual" && (
              <span className={styles.hint}>Runs only when you hit “Run now”.</span>
            )}
          </div>

          {/* conditions */}
          <div className={styles.field}>
            <span className={styles.fieldLbl}>
              Conditions <span className={styles.fieldNote}>all must match · optional</span>
            </span>
            <div className={styles.rowsList}>
              {draft.conditions.length === 0 && (
                <span className={styles.muted}>No conditions — matches any asset.</span>
              )}
              {draft.conditions.map((c, i) => (
                <div key={i} className={styles.editRow}>
                  <select
                    className={styles.selectSm}
                    value={c.field}
                    onChange={(e) => updateCondition(i, { field: e.target.value as CondField })}
                  >
                    {COND_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select
                    className={styles.selectSm}
                    value={c.op}
                    onChange={(e) => updateCondition(i, { op: e.target.value as CondOp })}
                  >
                    {COND_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    className={styles.inputSm}
                    value={c.value}
                    placeholder={c.op === "in" ? "video, image" : c.field === "path" ? "/raw/**" : "value"}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                  />
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeCondition(i)}
                    aria-label="Remove condition"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button className={styles.addBtn} onClick={addCondition}>
              <Icon name="create" size={13} /> Add condition
            </button>
          </div>

          {/* steps */}
          <div className={styles.field}>
            <span className={styles.fieldLbl}>
              Steps <span className={styles.fieldNote}>run in order · at least one</span>
            </span>
            <div className={styles.rowsList}>
              {draft.steps.map((s, i) => (
                <div key={i} className={styles.editRow}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <select
                    className={styles.selectSm}
                    value={s.action}
                    onChange={(e) => updateStep(i, { action: e.target.value as StepAction, param: "" })}
                  >
                    {STEP_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {s.action === "tag" && (
                    <input
                      className={styles.inputSm}
                      value={s.param}
                      placeholder="label (e.g. selects)"
                      onChange={(e) => updateStep(i, { param: e.target.value })}
                    />
                  )}
                  {s.action === "notify" && (
                    <input
                      className={styles.inputSm}
                      value={s.param}
                      placeholder="message…"
                      onChange={(e) => updateStep(i, { param: e.target.value })}
                    />
                  )}
                  {s.action !== "tag" && s.action !== "notify" && (
                    <span className={styles.noParam}>no params</span>
                  )}
                  <div className={styles.reorder}>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      aria-label="Move step up"
                    >
                      <Icon name="chevronDown" size={12} className={styles.flipUp} />
                    </button>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => moveStep(i, 1)}
                      disabled={i === draft.steps.length - 1}
                      aria-label="Move step down"
                    >
                      <Icon name="chevronDown" size={12} />
                    </button>
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeStep(i)}
                    disabled={draft.steps.length <= 1}
                    aria-label="Remove step"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button className={styles.addBtn} onClick={addStep}>
              <Icon name="create" size={13} /> Add step
            </button>
          </div>
        </div>

        <div className={styles.panelFt}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={onSave} disabled={saving || !canSave}>
            <Icon name="check" size={14} />
            {saving ? "Saving…" : draft.id == null ? "Create rule" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
