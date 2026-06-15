"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Btn, Pill, Overlay, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { topLevelBrands, subBrandsOf, type BrandProfile } from "@/lib/brandTypes";

const SOURCE_LABEL: Record<string, string> = {
  guide: "From brand book",
  stub: "Stub — fill in",
  demo: "Demo-extracted",
};

export default function BrandsPage() {
  const toast = useToast();
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const projects = useMemo(() => topLevelBrands(brands), [brands]);

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Brands · Projects</p>
          <h1 className="t-h1">Brand profiles</h1>
          <p className="t-body">
            Each brand is a saved formula — palette, type, principles and a style string that locks
            the look across every shot. Pick one in the composer and the brand-DNA rides along with
            your prompt. Projects can hold sub-brands (PortalOne → its games).
          </p>
        </div>
        <div className="actions">
          <Btn variant="primary" icon="create" onClick={() => setCreating(true)}>
            New brand
          </Btn>
        </div>
      </div>

      <Card pad className="brand-demo-note">
        <span style={{ color: "var(--accent-hi)", marginTop: 1 }}>
          <Icon name="spark" size={16} />
        </span>
        <div className="grow">
          <div className="t-sm" style={{ fontWeight: 600 }}>
            Demo mode — the brand formula is a stub
          </div>
          <div className="t-xs muted" style={{ marginTop: 2 }}>
            New brands mine hex colors and tone cues from whatever guide text you paste, then assemble
            a style string. A production version would hand the brand book to a model for real
            extraction. Hand-authored profiles (PortalOne, StarXI, StrikeLab) are already locked in.
          </div>
        </div>
      </Card>

      {loading ? (
        <Card pad style={{ marginTop: 16 }}>
          <p className="t-sm muted">Loading brands…</p>
        </Card>
      ) : (
        <div className="brand-grid">
          {projects.map((p) => (
            <BrandCard key={p.id} project={p} subs={subBrandsOf(brands, p.id)} />
          ))}
        </div>
      )}

      {creating && (
        <NewBrandModal
          projects={projects}
          onClose={() => setCreating(false)}
          onCreated={(b) => {
            setCreating(false);
            toast({ kind: "ok", title: "Brand saved", sub: `${b.label} · demo formula` });
            load();
          }}
        />
      )}
    </div>
  );
}

function Swatches({ colors, size = 22 }: { colors: string[]; size?: number }) {
  if (!colors?.length) return null;
  return (
    <div className="brand-swatches">
      {colors.map((c) => (
        <span key={c} title={c} style={{ background: c, width: size, height: size }} />
      ))}
    </div>
  );
}

function BrandCard({ project, subs }: { project: BrandProfile; subs: BrandProfile[] }) {
  const fonts = project.fonts ? Object.values(project.fonts).filter(Boolean) : [];
  return (
    <Card className="brand-card">
      <div className="brand-card-hd">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row gap2" style={{ alignItems: "center" }}>
            <span className="t-h3">{project.label}</span>
            {project.source && <Pill state="queued" label={SOURCE_LABEL[project.source] ?? project.source} />}
          </div>
          {project.tagline && <p className="t-sm" style={{ color: "var(--tx-2)", marginTop: 4 }}>{project.tagline}</p>}
        </div>
      </div>

      <div className="card-pad col gap3">
        <Swatches colors={project.palette ?? []} />

        {fonts.length > 0 && (
          <div className="col gap1">
            <span className="t-label" style={{ margin: 0 }}>Type</span>
            <div className="col gap1">
              {fonts.map((f) => (
                <span key={f} className="t-xs" style={{ color: "var(--tx-2)" }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {project.values && (
          <div className="col gap1">
            <span className="t-label" style={{ margin: 0 }}>Values</span>
            <span className="t-xs" style={{ color: "var(--tx-2)" }}>{project.values}</span>
          </div>
        )}

        {project.principles && project.principles.length > 0 && (
          <div className="col gap1">
            <span className="t-label" style={{ margin: 0 }}>Principles</span>
            <ul className="brand-principles">
              {project.principles.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="col gap1">
          <span className="t-label" style={{ margin: 0 }}>Style lock</span>
          <p className="review-prompt mono" style={{ fontSize: 11 }}>{project.style}</p>
        </div>

        {subs.length > 0 && (
          <div className="col gap2">
            <span className="t-label" style={{ margin: 0 }}>Sub-brands · {subs.length}</span>
            <div className="brand-subs">
              {subs.map((s) => (
                <div key={s.id} className="brand-sub">
                  <Swatches colors={(s.palette ?? []).slice(0, 4)} size={14} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row gap2" style={{ alignItems: "center" }}>
                      <span className="t-sm" style={{ fontWeight: 600 }}>{s.label}</span>
                      {s.source === "stub" && <span className="t-xs muted">stub</span>}
                    </div>
                    {s.tagline && <span className="t-xs muted">{s.tagline}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="between" style={{ marginTop: 2 }}>
          {project.website ? (
            <a className="t-xs" href={project.website} target="_blank" rel="noreferrer" style={{ color: "var(--accent-hi)" }}>
              {project.website.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : (
            <span className="t-xs muted">No website set</span>
          )}
          <a className="btn btn-ghost btn-sm" href="/create">
            Use in Create <Icon name="arrowRight" size={13} />
          </a>
        </div>
      </div>
    </Card>
  );
}

function NewBrandModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: BrandProfile[];
  onClose: () => void;
  onCreated: (b: BrandProfile) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [parent, setParent] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || undefined,
          parent: parent || undefined,
          sourceText: sourceText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onCreated(data.brand as BrandProfile);
    } catch (err) {
      toast({ kind: "bad", title: "Couldn't save brand", sub: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} className="center">
      <Card pad className="brand-modal">
        <div className="between">
          <div>
            <p className="t-label t-eyebrow">Demo formula</p>
            <span className="t-h3">New brand</span>
          </div>
          <button className="icon-btn ghost" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="col gap3" style={{ marginTop: 16 }}>
          <div className="col gap1">
            <label className="field-label">Brand name</label>
            <input className="input" placeholder="e.g. Centipede" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="split even">
            <div className="col gap1">
              <label className="field-label">Parent project (optional)</label>
              <select className="input" value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">— Top-level brand —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="col gap1">
              <label className="field-label">Website (optional)</label>
              <input className="input" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </div>

          <div className="col gap1">
            <label className="field-label">Brand material — paste guide text, hex colors, tone words</label>
            <textarea
              className="input"
              style={{ minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
              placeholder="Paste anything: #FE00A5 #00E8FF, retro 80s neon synthwave, bold, playful…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
            <span className="t-xs muted">
              The demo formula extracts hex colors and tone cues. The richer the paste, the better the lock.
            </span>
          </div>
        </div>

        <div className="between" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel · esc</button>
          <Btn variant="primary" icon="spark" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Synthesizing…" : "Synthesize brand"}
          </Btn>
        </div>
      </Card>
    </Overlay>
  );
}
