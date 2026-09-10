import { ENV } from "./env";

export type TranscribeOptions = { audioUrl: string; language?: string; prompt?: string };
export type WhisperSegment = {
  id: number; seek: number; start: number; end: number; text: string; tokens: number[];
  temperature: number; avg_logprob: number; compression_ratio: number; no_speech_prob: number;
};
export type WhisperResponse = { task: "transcribe"; language: string; duration: number; text: string; segments: WhisperSegment[] };
export type TranscriptionResponse = WhisperResponse;
export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    if (!ENV.openAiApiKey) return { error: "Voice transcription service is not configured", code: "SERVICE_ERROR", details: "OPENAI_API_KEY is not set" };
    const source = await fetch(options.audioUrl);
    if (!source.ok) return { error: "Failed to download audio file", code: "INVALID_FORMAT", details: `HTTP ${source.status}: ${source.statusText}` };
    const audioBuffer = Buffer.from(await source.arrayBuffer());
    if (audioBuffer.length > 16 * 1024 * 1024) return { error: "Audio file exceeds maximum size limit", code: "FILE_TOO_LARGE" };
    const mimeType = source.headers.get("content-type") || "audio/mpeg";
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), `audio.${getFileExtension(mimeType)}`);
    formData.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1");
    formData.append("response_format", "verbose_json");
    if (options.language) formData.append("language", options.language);
    if (options.prompt) formData.append("prompt", options.prompt);
    const response = await fetch(`${ENV.openAiBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${ENV.openAiApiKey}` },
      body: formData,
    });
    if (!response.ok) return { error: "Transcription service request failed", code: "TRANSCRIPTION_FAILED", details: `${response.status} ${response.statusText}` };
    const result = await response.json() as WhisperResponse;
    if (!result.text || typeof result.text !== "string") return { error: "Invalid transcription response", code: "SERVICE_ERROR" };
    return result;
  } catch (error) {
    return { error: "Voice transcription failed", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}

function getFileExtension(mimeType: string): string {
  return ({ "audio/webm": "webm", "audio/mp3": "mp3", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/wave": "wav", "audio/ogg": "ogg", "audio/m4a": "m4a", "audio/mp4": "m4a" } as Record<string, string>)[mimeType] || "audio";
}
