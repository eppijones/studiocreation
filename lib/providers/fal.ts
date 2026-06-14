import { fal } from "@fal-ai/client";
import type {
  GenerateImageInput,
  GenerateImageResult,
  Provider,
  QueueDetails,
  QueueStatus,
  SubmitJobInput,
} from "./types";

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

  async submitJob(input: SubmitJobInput): Promise<{ requestId: string }> {
    const { request_id } = await fal.queue.submit(input.model, {
      input: input.input,
      webhookUrl: input.webhookUrl,
    });
    return { requestId: request_id };
  },

  async getJobStatus(model: string, requestId: string): Promise<QueueStatus> {
    const status = await fal.queue.status(model, { requestId, logs: false });
    return status.status as QueueStatus;
  },

  async getQueueDetails(model: string, requestId: string): Promise<QueueDetails> {
    const status = await fal.queue.status(model, { requestId, logs: false });
    const pos = (status as { queue_position?: number }).queue_position;
    return {
      status: status.status as QueueStatus,
      queuePosition: typeof pos === "number" ? pos : null,
    };
  },

  async getJobResult(model: string, requestId: string): Promise<Record<string, unknown>> {
    const result = await fal.queue.result(model, { requestId });
    return result.data as Record<string, unknown>;
  },

  async cancelJob(model: string, requestId: string): Promise<void> {
    await fal.queue.cancel(model, { requestId });
  },
};
