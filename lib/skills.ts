import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

export interface StudioPreset {
  kind: "image" | "video";
  model: string;
  ratio: string;
  seconds?: number;
  style: string;
}

export interface Employee {
  id: string;
  name: string;
  description: string;
  studio: StudioPreset | null;
}

const SKILLS_DIR = join(process.cwd(), ".claude", "skills");

export function listEmployees(): Employee[] {
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const employees: Employee[] = [];
  for (const dir of dirs) {
    try {
      const raw = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf8");
      const { data } = matter(raw);
      const studio = data.studio
        ? {
            kind: data.studio.kind === "video" ? ("video" as const) : ("image" as const),
            model: String(data.studio.model ?? "fal-ai/flux/schnell"),
            ratio: String(data.studio.ratio ?? "1:1"),
            seconds: data.studio.seconds ? Number(data.studio.seconds) : undefined,
            style: String(data.studio.style ?? ""),
          }
        : null;
      employees.push({
        id: dir,
        name: String(data.name ?? dir),
        description: String(data.description ?? ""),
        studio,
      });
    } catch {
      continue;
    }
  }
  return employees;
}
