import { storagePut } from "../storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{ url?: string; b64Json?: string; mimeType?: string }>;
};
export type GenerateImageResponse = { url?: string };

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch(`${ENV.openAiBaseUrl}/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ENV.openAiApiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
      prompt: options.prompt,
      ...(options.originalImages?.length ? { images: options.originalImages } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Image generation request failed (${response.status} ${response.statusText})`);
  const result = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = result.data?.[0];
  if (!image) throw new Error("Image generation returned no image");
  if (image.url) return { url: image.url };
  if (!image.b64_json) throw new Error("Image generation returned no image data");
  const { url } = await storagePut(`generated/${Date.now()}.png`, Buffer.from(image.b64_json, "base64"), "image/png");
  return { url };
}
