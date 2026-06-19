"use client";

import { type CSSProperties } from "react";
import { DELIVERY_PRESETS, previewFrame, type CaptionPos } from "@/lib/finishing";

// Uniform tile HEIGHT so every output is comparable; width follows the ratio.
const FRAME_H = 116;

/** Caption overlay positioned to mirror the ffmpeg `drawtext` filter: centred
 *  horizontally, font sized to the output frame (h/18), white-on-black box, at
 *  the chosen top / center / bottom anchor (y = h*0.07 / centred / h*0.86). */
function captionStyle(pos: CaptionPos): CSSProperties {
  const fontPx = FRAME_H / 18;
  const base: CSSProperties = {
    position: "absolute",
    left: "50%",
    fontSize: fontPx,
    lineHeight: 1.15,
    fontWeight: 600,
    color: "#fff",
    background: "rgba(0,0,0,0.55)",
    padding: `${fontPx * 0.3}px ${fontPx * 0.55}px`,
    borderRadius: 2,
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
  if (pos === "top") return { ...base, top: "7%", transform: "translateX(-50%)" };
  if (pos === "center") return { ...base, top: "50%", transform: "translate(-50%, -50%)" };
  return { ...base, bottom: "14%", transform: "translateX(-50%)" };
}

/** A single export tile: the source framed exactly as its $0 ffmpeg recipe will
 *  crop / letterbox it, with the live grade applied via CSS filter and the
 *  burned-in caption previewed at its real position. */
function PreviewTile({
  presetId,
  src,
  isVideo,
  gradeCss,
  caption,
  captionPos,
  selected,
  onSelect,
}: {
  presetId: string;
  src?: string | null;
  isVideo: boolean;
  gradeCss: string;
  caption: string;
  captionPos: CaptionPos;
  selected: boolean;
  onSelect: () => void;
}) {
  const preset = DELIVERY_PRESETS.find((p) => p.id === presetId)!;
  const { frameRatio, fit, bandRatio } = previewFrame(preset);

  const mediaStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: fit,
    filter: gradeCss,
    display: "block",
  };

  const media = src ? (
    isVideo ? (
      <video
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        style={mediaStyle}
        // nudge the first frame to paint so the still framing is visible
        onLoadedMetadata={(e) => {
          try {
            e.currentTarget.currentTime = 0.05;
          } catch {
            /* no-op */
          }
        }}
        onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => {
          e.currentTarget.pause();
          e.currentTarget.currentTime = 0.05;
        }}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={preset.label} loading="lazy" style={mediaStyle} />
    )
  ) : null;

  const hasCaption = caption.trim().length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={preset.label}
      className={`export-tile ${selected ? "on" : ""}`}
      aria-pressed={selected}
    >
      <div
        className="export-frame"
        style={{ height: FRAME_H, aspectRatio: String(frameRatio) }}
      >
        {bandRatio ? (
          // letterbox: picture band centred on black, the rest are baked bars
          <div className="export-band" style={{ aspectRatio: String(bandRatio) }}>
            {media}
          </div>
        ) : (
          media
        )}
        {/* drawtext is applied after scale/pad, so it sits on the full output
            canvas — over the black bars for letterbox, exactly like ffmpeg. */}
        {hasCaption && <span style={captionStyle(captionPos)}>{caption.trim()}</span>}
      </div>
      <span className="export-cap">
        <b>{preset.ratio}</b>
        <span className="export-dim">
          {preset.width}×{preset.height}
        </span>
      </span>
    </button>
  );
}

/** WYSIWYG export previewer — every delivery preset framed exactly as its $0
 *  ffmpeg recipe will produce it, with the selected grade and burned-in caption
 *  applied live. Click a tile to pick that format (drives the copied command). */
export function ExportPreview({
  src,
  isVideo,
  gradeCss,
  caption,
  captionPos,
  selectedId,
  onSelect,
}: {
  src?: string | null;
  isVideo: boolean;
  gradeCss: string;
  caption: string;
  captionPos: CaptionPos;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="export-grid">
      {DELIVERY_PRESETS.map((p) => (
        <PreviewTile
          key={p.id}
          presetId={p.id}
          src={src}
          isVideo={isVideo}
          gradeCss={gradeCss}
          caption={caption}
          captionPos={captionPos}
          selected={selectedId === p.id}
          onSelect={() => onSelect(p.id)}
        />
      ))}
    </div>
  );
}
