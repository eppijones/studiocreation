"use client";

import { useEffect, useMemo, useState } from "react";

interface GalleryAsset {
  id: number;
  blob_url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  created_at: string;
  model: string;
  project: string;
  label: string;
  operator: string;
  prompt: string;
  est_usd: string;
  actual_usd: string | null;
}

export default function GalleryPage() {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [lightbox, setLightbox] = useState<GalleryAsset | null>(null);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(d.assets))
      .catch(() => {});
  }, []);

  const projects = useMemo(() => [...new Set(assets.map((a) => a.project))], [assets]);
  const models = useMemo(() => [...new Set(assets.map((a) => a.model))], [assets]);

  const filtered = assets.filter(
    (a) =>
      (!projectFilter || a.project === projectFilter) && (!modelFilter || a.model === modelFilter)
  );

  async function setScore(asset: GalleryAsset, score: number | null) {
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
    if (res.ok) {
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, score } : a)));
    }
  }

  const totalUsd = filtered.reduce(
    (sum, a) => sum + Number(a.actual_usd ?? a.est_usd ?? 0),
    0
  );

  return (
    <main style={{ maxWidth: 1100 }}>
      <h1>Gallery</h1>
      <p className="subtitle">
        {filtered.length} assets · ${totalUsd.toFixed(2)} spent · <a href="/">generate</a> ·{" "}
        <a href="/costs">costs</a>
      </p>

      <div className="row" style={{ marginBottom: 20 }}>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ flex: 1 }}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} style={{ flex: 1 }}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="gallery-grid">
        {filtered.map((asset) => {
          const isVideo = asset.content_type?.startsWith("video");
          return (
            <div className="gallery-card" key={asset.id}>
              <div className="gallery-media" onClick={() => setLightbox(asset)}>
                {isVideo ? (
                  <video src={asset.blob_url} muted loop playsInline autoPlay />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.blob_url} alt={asset.label} loading="lazy" />
                )}
              </div>
              <div className="gallery-meta">
                <span className="label">{asset.label}</span>
                <span className="sub">
                  {asset.model.replace("fal-ai/", "")} · {asset.project} · {asset.operator}
                </span>
                <span className="cost">${Number(asset.actual_usd ?? asset.est_usd).toFixed(3)}</span>
                <select
                  className="score-select"
                  value={asset.score ?? ""}
                  onChange={(e) => setScore(asset, e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">unscored</option>
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i}>
                      {i}/10
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="estimate">Nothing here yet.</p>}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          {lightbox.content_type?.startsWith("video") ? (
            <video src={lightbox.blob_url} controls autoPlay />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.blob_url} alt={lightbox.label} />
          )}
          <p className="estimate">{lightbox.prompt}</p>
        </div>
      )}
    </main>
  );
}
