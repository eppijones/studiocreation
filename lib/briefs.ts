import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { estimate, modelUnit } from "./pricing";

export interface Shot {
  label: string;
  model: string;
  prompt: string;
  ratio: string;
  count: number;
  kind: "image" | "video";
  estUsd: number;
}

export interface Brief {
  id: string;
  title: string;
  project: string;
  shots: Shot[];
  totalUsd: number;
}

const BRIEFS_DIR = join(process.cwd(), "briefs");

/**
 * Shot tables are markdown: | label | model | prompt | ratio | count |
 * count = images for image models, seconds for video models.
 */
function parseShots(markdown: string): Shot[] {
  const shots: Shot[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 5) continue;
    const [label, model, prompt, ratio, countRaw] = cells;
    if (label === "label" || /^[-: ]+$/.test(label)) continue; // header/separator
    if (!model.startsWith("fal-ai/")) continue;
    const count = Math.max(Number(countRaw) || 1, 1);
    const kind = modelUnit(model) === "video_second" ? "video" : "image";
    let estUsd = 0;
    try {
      estUsd = estimate({ provider: "fal", model, count }).usd;
    } catch {
      continue; // unknown model — skip the row
    }
    shots.push({ label, model, prompt, ratio, count, kind, estUsd });
  }
  return shots;
}

export function listBriefs(): Brief[] {
  if (!existsSync(BRIEFS_DIR)) return [];
  const files = readdirSync(BRIEFS_DIR).filter((f) => f.endsWith(".md")).sort();
  return files.map((file) => {
    const raw = readFileSync(join(BRIEFS_DIR, file), "utf8");
    const id = file.replace(/\.md$/, "");
    const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? id;
    const project = id.split("-")[0] || "studio";
    const shots = parseShots(raw);
    return {
      id,
      title,
      project,
      shots,
      totalUsd: shots.reduce((sum, s) => sum + s.estUsd, 0),
    };
  });
}
