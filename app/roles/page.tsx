"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listModels } from "@/lib/pricing";
import { Card, Btn } from "../components/ui";
import { Icon } from "../components/Icon";
import { hueFor } from "../components/studio";

const MODELS = listModels();
const modelLabel = (id?: string) => MODELS.find((m) => m.id === id)?.label ?? id ?? "";

// Same glyph mapping the Create role tiles use, so a role reads identically here.
const ROLE_ICON: Record<string, string> = {
  "premium-motion-designer": "film",
  "video-editor": "video",
  "audio-engineer": "bolt",
  "some-strategist": "spark",
  "graphic-designer": "image",
  "concept-artist": "wand",
  "keynote-designer": "dashboard",
  "product-photographer": "gallery",
  upscaler: "bolt",
};

interface Role {
  id: string;
  name: string;
  description: string;
  studio: { kind: "image" | "video"; model: string; ratio: string; seconds?: number; style: string } | null;
}

function roleMesh(hue: number): string {
  return (
    `radial-gradient(95% 120% at 14% 6%, oklch(0.6 0.2 ${hue}) 0%, transparent 56%),` +
    `radial-gradient(85% 110% at 88% 16%, oklch(0.52 0.22 ${(hue + 70) % 360}) 0%, transparent 52%),` +
    `var(--bg-2)`
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setRoles(d.employees ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">The cast</p>
          <h1 className="t-h1">Your studio specialists</h1>
          <p className="t-body">
            Each role is a preset specialist — pick one in Create to route the right model and ratio
            and auto-append its house style. They’re creative shortcuts, not separate logins.
          </p>
        </div>
        <div className="actions">
          <Link href="/create">
            <Btn variant="primary" size="lg" icon="create">
              Open Create
            </Btn>
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="t-sm muted">Loading the roster…</p>
      ) : roles.length === 0 ? (
        <div className="empty">
          <Icon name="wand" size={40} />
          <span>No roles found — check the .claude/skills folder.</span>
        </div>
      ) : (
        <div className="grid-auto" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {roles.map((r) => {
            const hue = hueFor(r.id);
            const summary = r.description ? r.description.split(/\s*Use for:/i)[0].trim() : "";
            const kind = r.studio?.kind === "video" ? "Video" : "Image";
            return (
              <Card key={r.id} pad style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="row gap3" style={{ alignItems: "center" }}>
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-md)",
                      display: "grid",
                      placeItems: "center",
                      background: roleMesh(hue),
                      color: "white",
                      flex: "none",
                    }}
                  >
                    <Icon name={ROLE_ICON[r.id] ?? (r.studio?.kind === "video" ? "video" : "image")} size={20} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="t-h3" style={{ margin: 0 }}>{r.name}</div>
                    <div className="t-xs mono muted">{kind} · {modelLabel(r.studio?.model)}{r.studio?.ratio ? ` · ${r.studio.ratio}` : ""}</div>
                  </div>
                </div>

                {summary && (
                  <p className="t-sm" style={{ color: "var(--tx-2)", margin: 0 }}>{summary}</p>
                )}

                {r.studio?.style ? (
                  <div className="review-prompt mono" style={{ fontSize: 11.5 }}>
                    <span className="muted">Appends to your prompt: </span>
                    <span style={{ color: "var(--accent-hi)" }}>{r.studio.style}</span>
                  </div>
                ) : (
                  <p className="t-xs muted" style={{ margin: 0 }}>Finishing role — your prompt is left untouched.</p>
                )}

                <div className="grow" />
                <Link href={`/create?role=${r.id}`}>
                  <Btn size="sm" icon="arrowRight">Use in Create</Btn>
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Card pad style={{ marginTop: 20 }}>
        <div className="t-label" style={{ margin: 0 }}>Always-on, behind every render</div>
        <p className="t-sm muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Two system specialists work automatically and aren’t pickable:{" "}
          <strong>prompt-optimizer</strong> sharpens a rough prompt into the model’s dialect before
          you spend, and <strong>quality-gate</strong> scores the result (Hook · Composition · Motion ·
          Brand DNA · Finish) before anything is called final.
        </p>
      </Card>
    </div>
  );
}
