export interface GenerateImageInput {
  model: string;
  prompt: string;
  numImages?: number;
  imageSize?: string;
}

export interface GeneratedImage {
  url: string;
  width?: number;
  height?: number;
  contentType?: string;
}

export interface GenerateImageResult {
  requestId: string;
  images: GeneratedImage[];
}

export interface SubmitJobInput {
  model: string;
  input: Record<string, unknown>;
  webhookUrl?: string;
}

export type QueueStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

export interface Provider {
  name: string;
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
  /** Async queue submission; completion arrives via webhook (or polling fallback). */
  submitJob(input: SubmitJobInput): Promise<{ requestId: string }>;
  getJobStatus(model: string, requestId: string): Promise<QueueStatus>;
  getJobResult(model: string, requestId: string): Promise<Record<string, unknown>>;
}
