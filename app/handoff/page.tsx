"use client";

import { useEffect, useMemo, useState } from "react";
import brands from "@/config/brands.json";

const BRAND_PROFILES = Object.entries(brands.profiles) as [
  string,
  { label: string; style: string; notes: string },
][];

const HF_FEATURES = [
  "Vibe Motion",
  "Lipsync Studio",
  "Canvas",
  "Soul training",
  "Adobe/DaVinci plugin",
  "Other web-UI feature",
];

interface Employee {
  id: string;
  name: string;
  description: string;
  studio: { kind: string; model: string; ratio: string; seconds?: number; style: string } | null;
}

export default function HandoffPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [brandId, setBrandId] = useState("none");
  const [feature, setFeature] = useState(HF_FEATURES[0]);
  const [brief, setBrief] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees))
      .catch(() => {});
  }, []);

  const employee = employees.find((e) => e.id === employeeId);
  const brand = BRAND_PROFILES.find(([id]) => id === brandId)?.[1];

  const pkg = useMemo(() => {
    const lines = [
      `# Paste-ready package — ${feature} (Higgsfield web UI)`,
      "",
      `## Brief`,
      brief.trim() || "(write the brief above)",
      "",
    ];
    if (employee?.studio) {
      lines.push(
        `## Direction (${employee.name})`,
        `- Style: ${employee.studio.style || "—"}`,
        `- Ratio: ${employee.studio.ratio}`,
        employee.studio.seconds ? `- Duration: ${employee.studio.seconds}s` : "",
        ""
      );
    }
    if (brand && brand.style) {
      lines.push(`## Brand lock`, `- ${brand.style}`, brand.notes ? `- ${brand.notes}` : "", "");
    }
    lines.push(
      `## After generating`,
      "1. Download the result from the web UI.",
      "2. Log it: `scripts/hf_pull.sh <url> <project> <model> <label> <credits>`",
      "3. Push to the ledger: `scripts/studio_sync.sh push`"
    );
    return lines.filter((l) => l !== undefined).join("\n");
  }, [feature, brief, employee, brand]);

  async function copy() {
    await navigator.clipboard.writeText(pkg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main>
      <h1>Handoff</h1>
      <p className="subtitle">
        Paste-ready packages for web-UI-only Higgsfield features · <a href="/">generate</a>
      </p>

      <div className="panel">
        <div className="row" style={{ marginTop: 0 }}>
          <div style={{ flex: 1 }}>
            <label>Feature</label>
            <select value={feature} onChange={(e) => setFeature(e.target.value)}>
              {HF_FEATURES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Employee</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— none —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Brand</label>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {BRAND_PROFILES.map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label>Brief</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What needs to be made?"
          />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="row" style={{ marginTop: 0 }}>
          <label style={{ margin: 0 }}>Package</label>
          <button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
        <pre className="handoff-pre">{pkg}</pre>
      </div>
    </main>
  );
}
