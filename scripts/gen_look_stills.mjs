/**
 * One-off: generate the curated camera-Look tile stills into public/looks/.
 * Mirrors the app's image call (lib/providers/fal.ts → fal.subscribe, GPT Image 2,
 * quality=high, portrait_4_3). Consistent subject across all five so only the LOOK
 * changes tile to tile. Billable — run only after a cost preflight + go (~$0.80).
 *
 *   node --env-file=.env scripts/gen_look_stills.mjs
 */
import { fal } from "@fal-ai/client";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

if (!process.env.FAL_KEY) {
  console.error("FAL_KEY missing — run with: node --env-file=.env scripts/gen_look_stills.mjs");
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

// Same traveler subject everywhere; each look applies its own framing/depth/light.
const LOOKS = [
  {
    id: "portrait",
    prompt:
      "Cinematic tight close-up portrait of a lone traveler's face, 85mm portrait lens, very shallow depth of field, creamy bokeh, subject isolated from a soft city-light background, soft diffused studio lighting, photorealistic",
  },
  {
    id: "epic-wide",
    prompt:
      "Cinematic wide establishing shot, a lone traveler standing small on a ridge above a vast futuristic city skyline, 24mm wide-angle lens, deep focus, everything sharp, warm golden-hour light, epic scale, photorealistic",
  },
  {
    id: "noir",
    prompt:
      "Film-noir medium shot of a lone traveler in a rain-slicked alley, 85mm lens, shallow depth of field, hard chiaroscuro lighting, deep black shadows, high contrast, moody, cinematic",
  },
  {
    id: "doc",
    prompt:
      "Candid documentary medium shot of a lone traveler walking through a busy city street, 50mm natural perspective, soft natural daylight, handheld camera feel, realistic, cinematic",
  },
  {
    id: "neon-macro",
    prompt:
      "Extreme macro close-up of glistening rain droplets on a traveler's jacket fabric, very shallow depth of field, creamy bokeh, moody neon practical lighting, magenta and cyan reflections, cinematic",
  },
];

const OUT = path.resolve("public/looks");
await mkdir(OUT, { recursive: true });

const done = [];
for (const lk of LOOKS) {
  try {
    process.stdout.write(`→ ${lk.id} … `);
    const result = await fal.subscribe("openai/gpt-image-2", {
      input: {
        prompt: lk.prompt,
        num_images: 1,
        quality: "high",
        output_format: "png",
        image_size: "portrait_4_3",
      },
    });
    const url = result.data?.images?.[0]?.url;
    if (!url) throw new Error("no image url in result");
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const pngPath = path.join(OUT, `${lk.id}.png`);
    await writeFile(pngPath, buf);
    // png → small jpg (max 480px, q82) so the repo stays lean; tiles are ~88px.
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "480", pngPath, "--out", path.join(OUT, `${lk.id}.jpg`)]);
    await rm(pngPath);
    done.push(lk.id);
    console.log("✓");
  } catch (err) {
    console.log(`✗ ${err.message}`);
  }
}
console.log(`\nDone: ${done.length}/${LOOKS.length} → public/looks/ (${done.join(", ")})`);
