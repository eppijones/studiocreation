"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStudio } from "../components/AppShell";
import { Card, Btn, Chip, Cost, Pill, Seg, useToast } from "../components/ui";
import { Media } from "../components/Media";
import { Icon } from "../components/Icon";
import { modelShort, money } from "../components/studio";
import {
  DELIVERY_PRESETS,
  ffmpegCommand,
  ffmpegImageCommand,
  type FinishAction,
} from "@/lib/finishing";

interface DeliverAsset {
  id: number;
  blob_url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  status: string;
  tags: string[];
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  model: string;
  project: string;
  label: string;
  prompt: string;
  source_asset_id: number | null;
}

const FPS_OPTIONS = [24, 25, 30, 50, 60];

export default function DeliverPage() {
  const { refresh } = useStudio();
  const toast = useToast();

  const [assets, setAssets] = useState<DeliverAsset[]>([]);
  const [presetByAsset, setPresetByAsset] = useState<Record<number, string>>({});
  const [fpsByAsset, setFpsByAsset] = useState<Record<number, number>>({});
  const [tagDraft, setTagDraft] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/assets");
    if (res.ok) setAssets((await res.json()).assets);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pipeline = useMemo(
    () => assets.filter((a) => a.status === "approved" || a.status === "delivered"),
    [assets]
  );
  const derivedOf = useCallback(
    (id: number) => assets.filter((a) => a.source_asset_id === id),
    [assets]
  );

  const deliveredCount = pipeline.filter((a) => a.status === "delivered").length;
  const readyCount = pipeline.length - deliveredCount;

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    }
  }

  async function finish(asset: DeliverAsset, action: FinishAction, confirmed = false) {
    setBusyId(asset.id);
    try {
      const targetFps = action === "upscale-video-4k" ? fpsByAsset[asset.id] ?? 30 : undefined;
      const res = await fetch("/api/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, action, targetFps, confirmed }),
      });
      const data = await res.json();
      if (res.status === 402) {
        const ok = window.confirm(
          `🎬 Finishing costs $${data.estimate.usd.toFixed(2)} (above the $${data.threshold} gate).\n${data.estimate.breakdown}\n\nSpend it?`
        );
        if (ok) return finish(asset, action, true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast({
        kind: "ok",
        title: `🎬 Finishing job #${data.jobId} queued`,
        sub: `${money(data.estimate.usd)} · master lands here & in the gallery`,
      });
      refresh();
    } catch (err) {
      toast({
        kind: "bad",
        title: "Finishing failed",
        sub: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Deliver · Finalize Center</p>
          <h1 className="t-display">Ship the heroes</h1>
          <p className="t-body">
            Only approved work gets finishing spend: 4K Topaz master, fps conform, platform exports
            at $0, then 🚀 delivered. {readyCount} ready · {deliveredCount} shipped.
          </p>
        </div>
      </div>

      {pipeline.length === 0 ? (
        <Card pad>
          <div className="empty" style={{ padding: "40px 0" }}>
            <Icon name="deliver" size={34} />
            <span>
              Nothing approved yet. Score the shots that clear the gate in the{" "}
              <Link href="/gallery" style={{ color: "var(--accent-hi)" }}>
                gallery
              </Link>{" "}
              and hit ✅.
            </span>
          </div>
        </Card>
      ) : (
        <div className="col gap4">
          {pipeline.map((asset) => {
            const isVideo = asset.content_type?.startsWith("video");
            const preset =
              DELIVERY_PRESETS.find((p) => p.id === presetByAsset[asset.id]) ?? DELIVERY_PRESETS[0];
            const derived = derivedOf(asset.id);
            const outName = `${asset.project}_${asset.label}_${preset.id}.${isVideo ? "mp4" : "png"}`;
            const cmd = isVideo
              ? ffmpegCommand(preset, asset.blob_url, outName)
              : ffmpegImageCommand(preset, asset.blob_url, outName);
            const fps = fpsByAsset[asset.id] ?? 30;
            const upscaleEst = isVideo
              ? Math.max(Math.ceil(asset.duration_s ?? 5), 1) * 0.08 * (fps >= 50 ? 2 : 1)
              : 0.08;
            const delivered = asset.status === "delivered";
            const cmdKey = `${asset.id}-${preset.id}`;

            return (
              <Card key={asset.id}>
                <div className="card-pad">
                  {/* HEAD — media + provenance + tags + finishing actions */}
                  <div className="row gap4 wrap">
                    <Media
                      src={asset.blob_url}
                      kind={asset.content_type}
                      hueKey={asset.id}
                      aspect={isVideo ? "16 / 9" : "1 / 1"}
                      style={{ width: 180, flex: "none" }}
                    />

                    <div className="grow col gap3" style={{ minWidth: 280 }}>
                      <div className="between wrap" style={{ gap: 8 }}>
                        <div>
                          <div className="row gap2" style={{ alignItems: "center" }}>
                            <span className="t-h3">
                              {asset.project}/{asset.label}
                            </span>
                            <span className="t-xs mono muted">#{asset.id}</span>
                            <Pill state={asset.status} />
                          </div>
                          <div className="t-xs mono muted" style={{ marginTop: 4 }}>
                            {modelShort(asset.model)} · {asset.width ?? "?"}×{asset.height ?? "?"}
                            {asset.duration_s ? ` · ${asset.duration_s}s` : ""} · score{" "}
                            {asset.score ?? "—"}/10 · approved by {asset.approved_by ?? "—"}
                          </div>
                        </div>
                        {delivered ? (
                          <Btn variant="ghost" size="sm" onClick={() => patch(asset.id, { status: "approved" })}>
                            Re-open
                          </Btn>
                        ) : (
                          <Btn variant="primary" size="sm" onClick={() => patch(asset.id, { status: "delivered" })}>
                            Mark delivered 🚀
                          </Btn>
                        )}
                      </div>

                      {/* TAGS */}
                      <div className="row gap2 wrap" style={{ alignItems: "center" }}>
                        <span className="t-label" style={{ margin: 0 }}>
                          Tags
                        </span>
                        {asset.tags.map((t) => (
                          <Chip
                            key={t}
                            onRemove={() => patch(asset.id, { tags: asset.tags.filter((x) => x !== t) })}
                          >
                            {t}
                          </Chip>
                        ))}
                        <input
                          className="input"
                          style={{ width: 200, height: 30, fontSize: 12 }}
                          placeholder="+ tag (hero, client-x, v2…)"
                          value={tagDraft[asset.id] ?? ""}
                          onChange={(e) => setTagDraft((p) => ({ ...p, [asset.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (tagDraft[asset.id] ?? "").trim()) {
                              patch(asset.id, { tags: [...asset.tags, tagDraft[asset.id].trim()] });
                              setTagDraft((p) => ({ ...p, [asset.id]: "" }));
                            }
                          }}
                        />
                      </div>

                      {/* FINISHING ACTIONS */}
                      <div>
                        <span className="t-label">Master — cloud finish (Topaz / Recraft)</span>
                        <div className="row gap2 wrap" style={{ marginTop: 8, alignItems: "center" }}>
                          {isVideo ? (
                            <>
                              <Seg
                                options={FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f}fps` }))}
                                value={String(fps)}
                                onChange={(v) => setFpsByAsset((p) => ({ ...p, [asset.id]: Number(v) }))}
                              />
                              <Btn
                                variant="primary"
                                size="sm"
                                icon="bolt"
                                disabled={busyId === asset.id}
                                onClick={() => finish(asset, "upscale-video-4k")}
                                title="Topaz Proteus: up to 4K + frame interpolation to the chosen fps"
                              >
                                {busyId === asset.id ? "Queueing…" : `4K @ ${fps}fps`}
                                <Cost usd={upscaleEst} />
                              </Btn>
                            </>
                          ) : (
                            <>
                              <Btn
                                variant="primary"
                                size="sm"
                                icon="bolt"
                                disabled={busyId === asset.id}
                                onClick={() => finish(asset, "upscale-image-4k")}
                              >
                                Topaz 4K <Cost usd={0.08} />
                              </Btn>
                              <Btn
                                variant="ghost"
                                size="sm"
                                disabled={busyId === asset.id}
                                onClick={() => finish(asset, "upscale-image-crisp")}
                              >
                                Crisp 2× <Cost usd={0.004} />
                              </Btn>
                            </>
                          )}
                        </div>
                      </div>

                      {/* DERIVED MASTERS */}
                      {derived.length > 0 && (
                        <div className="row gap2 wrap" style={{ alignItems: "center" }}>
                          <span className="t-label" style={{ margin: 0 }}>
                            Masters
                          </span>
                          {derived.map((d) => (
                            <a
                              key={d.id}
                              href={d.blob_url}
                              target="_blank"
                              rel="noreferrer"
                              className="chip"
                              style={{ textDecoration: "none" }}
                            >
                              <Icon name="download" size={12} />#{d.id} {d.label}{" "}
                              {d.width ? `${d.width}×${d.height}` : ""}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hr" style={{ margin: "16px 0" }} />

                  {/* PLATFORM EXPORT — $0 ffmpeg recipe */}
                  <div className="col gap2">
                    <div className="between wrap" style={{ gap: 8 }}>
                      <span className="t-label" style={{ margin: 0 }}>
                        Platform export — local ffmpeg recipe{" "}
                        <span className="cost" style={{ marginLeft: 4 }}>
                          $0
                        </span>
                      </span>
                      <Btn
                        variant="ghost"
                        size="sm"
                        icon={copied === cmdKey ? "check" : "copy"}
                        onClick={() => copy(cmd, cmdKey)}
                      >
                        {copied === cmdKey ? "Copied" : "Copy command"}
                      </Btn>
                    </div>
                    <div className="row gap2 wrap">
                      {DELIVERY_PRESETS.map((p) => (
                        <Chip
                          key={p.id}
                          on={preset.id === p.id}
                          onClick={() => setPresetByAsset((prev) => ({ ...prev, [asset.id]: p.id }))}
                        >
                          {p.ratio} · {p.width}×{p.height}
                        </Chip>
                      ))}
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: "12px 14px",
                        background: "var(--bg-1)",
                        border: "1px solid var(--line-1)",
                        borderRadius: "var(--r-md)",
                        overflowX: "auto",
                        fontSize: 11.5,
                        lineHeight: 1.55,
                        color: "var(--tx-2)",
                      }}
                    >
                      <code className="mono">{cmd}</code>
                    </pre>
                    <p className="t-xs muted" style={{ margin: 0 }}>
                      {preset.label} — {preset.notes} Run locally ($0) on the best master above. File Law
                      name: <code className="mono">{outName}</code>.
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
