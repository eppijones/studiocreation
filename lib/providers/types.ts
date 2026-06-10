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

export interface Provider {
  name: string;
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
}
