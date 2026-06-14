import { describe, it, expect } from "vitest";
import { buildFalInput, falEndpoint, type GenerateSpec } from "@/lib/providers/falInput";

function imageSpec(over: Partial<GenerateSpec> = {}): GenerateSpec {
  return {
    prompt: "a test render",
    kind: "image",
    numImages: 2,
    seconds: 0,
    ratio: "16:9",
    audio: false,
    fast: false,
    ...over,
  };
}

function videoSpec(over: Partial<GenerateSpec> = {}): GenerateSpec {
  return {
    prompt: "a test shot",
    kind: "video",
    numImages: 1,
    seconds: 5,
    ratio: "9:16",
    audio: false,
    fast: false,
    ...over,
  };
}

describe("buildFalInput — images", () => {
  it("maps GPT Image 2 ratio→image_size, defaults quality high, png", () => {
    const input = buildFalInput("openai/gpt-image-2", imageSpec());
    expect(input.quality).toBe("high");
    expect(input.output_format).toBe("png");
    expect(input.image_size).toBe("landscape_16_9");
    expect(input.num_images).toBe(2);
  });

  it("uses an explicit 4k pixel size on GPT Image 2", () => {
    const input = buildFalInput("openai/gpt-image-2", imageSpec({ tier: "4k" }));
    expect(input.image_size).toEqual({ width: 3840, height: 2160 });
  });

  it("attaches up to 10 references on the GPT edit endpoint", () => {
    const refs = Array.from({ length: 12 }, (_, i) => `https://blob.example/${i}.png`);
    const input = buildFalInput("openai/gpt-image-2/edit", imageSpec({ refImageUrls: refs }));
    expect((input.image_urls as string[]).length).toBe(10);
  });

  it("maps FLUX Kontext to image_url + aspect_ratio", () => {
    const input = buildFalInput("fal-ai/flux-pro/kontext", imageSpec({ refImageUrls: ["https://blob.example/a.png"] }));
    expect(input.image_url).toBe("https://blob.example/a.png");
    expect(input.aspect_ratio).toBe("16:9");
  });

  it("Qwen edit takes ≤3 image_urls and no aspect_ratio", () => {
    const input = buildFalInput("fal-ai/qwen-image-2/edit", imageSpec({ refImageUrls: ["a", "b", "c", "d"].map((s) => `https://blob.example/${s}.png`) }));
    expect((input.image_urls as string[]).length).toBe(3);
    expect(input.aspect_ratio).toBeUndefined();
  });
});

describe("buildFalInput — video", () => {
  it("Veo 3.1 emits Ns duration, explicit audio flag, 720p", () => {
    const input = buildFalInput("fal-ai/veo3.1/fast", videoSpec({ seconds: 6, audio: true }));
    expect(input.duration).toBe("6s");
    expect(input.generate_audio).toBe(true);
    expect(input.resolution).toBe("720p");
  });

  it("Kling v3 sets audio + negative prompt and i2v image_url", () => {
    const input = buildFalInput("fal-ai/kling-video/v3/pro/image-to-video", videoSpec({ audio: true, negativePrompt: "blurry", refImageUrls: ["https://blob.example/f.png"] }));
    expect(input.generate_audio).toBe(true);
    expect(input.negative_prompt).toBe("blurry");
    expect(input.image_url).toBe("https://blob.example/f.png");
  });

  it("Kling v2.5 turbo snaps to discrete duration and never sets audio", () => {
    const input = buildFalInput("fal-ai/kling-video/v2.5-turbo/pro/text-to-video", videoSpec({ seconds: 7 }));
    expect(input.duration).toBe("5"); // snapped to nearest of [5,10]
    expect(input.generate_audio).toBeUndefined();
  });

  it("Seedance reference-to-video carries typed ref arrays at 1080p", () => {
    const input = buildFalInput(
      "bytedance/seedance-2.0/reference-to-video",
      videoSpec({
        seconds: 8,
        refImageUrls: Array.from({ length: 11 }, (_, i) => `https://blob.example/i${i}.png`),
        refVideoUrls: ["https://blob.example/v1.mp4"],
        refAudioUrls: ["https://blob.example/a1.mp3"],
      })
    );
    expect((input.image_urls as string[]).length).toBe(9);
    expect((input.video_urls as string[]).length).toBe(1);
    expect((input.audio_urls as string[]).length).toBe(1);
    expect(input.resolution).toBe("1080p");
  });
});

describe("falEndpoint — fast-lane routing", () => {
  it("rewrites Seedance to the /fast/ endpoint when fast is requested", () => {
    expect(falEndpoint("bytedance/seedance-2.0/text-to-video", videoSpec({ fast: true }))).toBe(
      "bytedance/seedance-2.0/fast/text-to-video"
    );
  });
  it("leaves the endpoint untouched without fast", () => {
    expect(falEndpoint("bytedance/seedance-2.0/text-to-video", videoSpec({ fast: false }))).toBe(
      "bytedance/seedance-2.0/text-to-video"
    );
  });
  it("does not touch non-Seedance models", () => {
    expect(falEndpoint("fal-ai/veo3.1/fast", videoSpec({ fast: true }))).toBe("fal-ai/veo3.1/fast");
  });
});
