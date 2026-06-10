import { fal } from "@fal-ai/client";
import type { GenerateImageInput, GenerateImageResult, Provider } from "./types";

// Server-only module: FAL_KEY must never reach a client bundle.
if (typeof window !== "undefined") {
  throw new Error("lib/providers/fal.ts was imported in a client bundle");
}

fal.config({ credentials: process.env.FAL_KEY });

interface FalImageOutput {
  images?: { url: string; width?: number; height?: number; content_type?: string }[];
}

export const falProvider: Provider = {
  name: "fal",

  async generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
    const result = await fal.subscribe(input.model, {
      input: {
        prompt: input.prompt,
        num_images: input.numImages ?? 1,
        ...(input.imageSize ? { image_size: input.imageSize } : {}),
      },
    });

    const data = result.data as FalImageOutput;
    return {
      requestId: result.requestId,
      images: (data.images ?? []).map((img) => ({
        url: img.url,
        width: img.width,
        height: img.height,
        contentType: img.content_type,
      })),
    };
  },
};
