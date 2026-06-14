"use client";

import { useRef, type CSSProperties } from "react";
import { Icon } from "./Icon";
import { glowVars, hueFor } from "./studio";

function isVideoKind(kind?: string | null): boolean {
  return !!kind && /video|mp4|webm|mov/.test(kind);
}

/** Shared inner layers: the living mesh + optional real media + grain + glyph. */
function MeshInner({
  src,
  kind,
  label,
}: {
  src?: string | null;
  kind?: string | null;
  label?: string;
}) {
  const vid = isVideoKind(kind);
  return (
    <>
      <div className="mesh" />
      {src ? (
        vid ? (
          <video src={src} muted loop playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label ?? ""} loading="lazy" />
        )
      ) : null}
      <div className="grain" />
      {!src && (
        <div className="mglyph">
          <Icon name={vid ? "video" : "image"} size={26} />
        </div>
      )}
      {label && <span className="ph-label">{label}</span>}
    </>
  );
}

/** Standalone thumbnail (job rows, references, dashboard mini) — mesh keyed to a hue. */
export function Media({
  src,
  kind,
  hueKey,
  label,
  aspect = "1 / 1",
  blurry,
  className = "",
  style,
}: {
  src?: string | null;
  kind?: string | null;
  hueKey?: string | number | null;
  label?: string;
  aspect?: string;
  blurry?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`media ${blurry ? "blurry" : ""} ${className}`}
      style={{ aspectRatio: aspect, ["--hue" as string]: hueFor(hueKey), ...style }}
    >
      <MeshInner src={src} kind={kind} label={label} />
    </div>
  );
}

export interface TileAsset {
  id: number | string;
  blob_url?: string | null;
  content_type?: string | null;
  score?: number | null;
  status?: string;
  label?: string;
  prompt?: string | null;
  hueKey?: string | number | null;
  aspect?: string;
  width?: number | null;
  height?: number | null;
  duration_s?: number | null;
  featured?: boolean;
}

export type TileFit = "cover" | "contain" | "natural";

/** Gallery / dashboard render tile — glows in its own colour, frames the whole
 *  image (no crop) in `natural` mode, with a hover caption + "used" ring. */
export function Tile({
  asset,
  onClick,
  blurry,
  fit = "cover",
  caption = false,
  ariaLabel,
}: {
  asset: TileAsset;
  onClick?: () => void;
  blurry?: boolean;
  fit?: TileFit;
  caption?: boolean;
  ariaLabel?: string;
}) {
  const kept = asset.status === "approved" || asset.status === "delivered";
  const vid = isVideoKind(asset.content_type);
  const ref = useRef<HTMLDivElement>(null);
  const src = asset.blob_url;
  const natural = fit === "natural" && !!src;

  // Video tiles preview muted on hover; sound + restart happen on click (overlay).
  const playPreview = () => {
    if (!vid) return;
    const v = ref.current?.querySelector("video");
    if (v) {
      v.currentTime = 0;
      v.muted = true;
      v.play().catch(() => {});
    }
  };
  const stopPreview = () => {
    if (!vid) return;
    const v = ref.current?.querySelector("video");
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  const showCap = caption && Boolean(asset.label || asset.prompt);

  return (
    <div
      ref={ref}
      className={`tile fit-${fit} ${natural ? "natural" : ""} ${kept ? "kept" : ""} ${blurry ? "blurry" : ""}`}
      style={{ ...glowVars(asset.hueKey ?? asset.id), ...(natural ? {} : { aspectRatio: asset.aspect ?? "1 / 1" }) }}
      onClick={onClick}
      onMouseEnter={playPreview}
      onMouseLeave={stopPreview}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mesh" />
      {src ? (
        vid ? (
          <video src={src} muted loop playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={asset.label ?? ""}
            loading="lazy"
            width={asset.width ?? undefined}
            height={asset.height ?? undefined}
          />
        )
      ) : (
        <div className="mglyph">
          <Icon name={vid ? "video" : "image"} size={26} />
        </div>
      )}
      <div className="grain" />

      {kept && (
        <span className="tile-badge used">
          <Icon name="checkcircle" size={11} /> USED
        </span>
      )}
      {asset.featured && (
        <span className="tile-badge feat" title="Featured on the login screen">
          <Icon name="spark" size={11} /> LOGIN
        </span>
      )}
      {asset.score != null && (
        <span className={`tile-score ${asset.score >= 8 ? "hi" : asset.score >= 5 ? "mid" : "lo"}`} title="AI fidelity score">
          {asset.score}
        </span>
      )}
      {vid && (
        <div className="tile-play">
          <Icon name="play" size={14} />
        </div>
      )}

      {showCap && (
        <div className="tile-cap">
          {asset.label && <span className="tile-title">{asset.label}</span>}
          {asset.prompt && <span className="tile-sub">{asset.prompt}</span>}
        </div>
      )}
    </div>
  );
}
