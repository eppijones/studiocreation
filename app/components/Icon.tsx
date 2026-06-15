import type { SVGProps } from "react";

/** Single 24-grid inline icon set, stroke-based. Solid glyphs pass fill. */
const PATHS: Record<string, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z",
  create: "M12 5v14M5 12h14",
  queue: "M4 7h16M4 12h16M4 17h10",
  gallery: "M4 5h16v14H4zM4 14l4-4 5 5M14 12l2-2 4 4",
  costs: "M12 2v20M7 6h8a3 3 0 010 6H9a3 3 0 000 6h9",
  briefs: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  deliver: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 13a7.7 7.7 0 000-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 00-1.7-1l-.3-2.5h-4l-.3 2.5a7.6 7.6 0 00-1.7 1l-2.3-1-2 3.4L4.6 11a7.7 7.7 0 000 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 001.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 001.7-1l2.3 1 2-3.4z",
  workflows: "M5 5h6v6H5zM13 13h6v6h-6zM11 8h2a3 3 0 013 3v2",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6z",
  gauge: "M12 13l4-4M5.6 18a9 9 0 1112.8 0M12 13a1 1 0 100-2 1 1 0 000 2z",
  trophy: "M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a4 4 0 004 4M17 6h3v1a4 4 0 01-4 4M9 18h6M10 18l.5-3h3l.5 3M8 21h8",
  play: "M8 5l11 7-11 7z",
  image: "M4 5h16v14H4zM8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 16l5-5 4 4 3-3 4 4",
  video: "M4 6h11v12H4zM15 10l5-3v10l-5-3z",
  check: "M5 13l4 4 10-11",
  checkcircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  x: "M6 6l12 12M18 6L6 18",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  sun: "M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19",
  moon: "M21 13a8 8 0 11-10-10 7 7 0 0010 10z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 3v3M20.5 4.5h-3",
  shield: "M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z",
  refresh: "M3 12a9 9 0 0115.5-6M21 6v4h-4M21 12a9 9 0 01-15.5 6M3 18v-4h4",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 016 0v3",
  film: "M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 14h4M16 9h4M16 14h4",
  copy: "M9 9h11v11H9zM4 15V4h11",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  share: "M4 12v8h16v-8M12 3v13M8 7l4-4 4 4",
  download: "M12 3v12M7 11l5 5 5-5M5 21h14",
  alert: "M12 3l9 16H3zM12 10v4M12 17v.5",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v4l3 2",
  dot: "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0",
  cpu: "M8 8h8v8H8zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3",
  wand: "M5 19l9-9M14 6l1.5-1.5M18 10l1.5-1.5M15 4l1 1M19 8l1 1M9 4l.7 2L12 6.7 9.7 7.4 9 10l-.7-2.6L6 6.7l2.3-.7z",
  hourglass: "M7 3h10M7 21h10M7 3c0 4 5 5 5 9s-5 5-5 9M17 3c0 4-5 5-5 9s5 5 5 9",
  expand: "M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3",
  compress: "M9 3v3a2 2 0 01-2 2H4M20 8h-3a2 2 0 01-2-2V3M15 21v-3a2 2 0 012-2h3M4 16h3a2 2 0 012 2v3",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  eyeoff: "M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 4.6A9.6 9.6 0 0112 4.5c6.4 0 10 7.5 10 7.5a18 18 0 01-3 3.7M6.1 6.1A18 18 0 002 12s3.6 7.5 10 7.5a9.6 9.6 0 003.9-.8",
};

const SOLID = new Set(["bolt", "play", "dot"]);

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  const solid = SOLID.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke={solid ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  );
}
