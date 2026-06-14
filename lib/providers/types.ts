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

export interface QueueDetails {
  status: QueueStatus;
  /** Position in the fal queue while IN_QUEUE; null once running/done or unknown. */
  queuePosition: number | null;
}

export interface Provider {
  name: string;
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
  /** Async queue submission; completion arrives via webhook (or polling fallback). */
  submitJob(input: SubmitJobInput): Promise<{ requestId: string }>;
  getJobStatus(model: string, requestId: string): Promise<QueueStatus>;
  /** Status + queue position in one call, for live progress. */
  getQueueDetails(model: string, requestId: string): Promise<QueueDetails>;
  getJobResult(model: string, requestId: string): Promise<Record<string, unknown>>;
  /** Best-effort cancel of a queued/running request. Throws if already gone. */
  cancelJob(model: string, requestId: string): Promise<void>;
}
