import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * llmEndpointConfig — pins how BUILT_IN_FORGE_API_URL / _MODEL are honoured.
 *
 * Why this exists: the launch stack documents Gemini 2.5 Flash via Google AI
 * Studio. Gemini's OpenAI-compatible surface lives at
 *   https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
 * — it is NOT under /v1, so a builder that only ever appends
 * "/v1/chat/completions" can never reach it. That made the documented AI setup
 * a guaranteed 404. The resolver now accepts either a host base or a full
 * endpoint path, and the model name is configurable per deployment.
 */

type Captured = { url?: string; body?: any };

function stubFetch(captured: Captured) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any) => {
      captured.url = url;
      captured.body = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        text: async () => "",
      } as any;
    }),
  );
}

async function invokeWith(env: {
  url?: string;
  key?: string;
  model?: string;
}): Promise<Captured> {
  vi.resetModules();
  if (env.url === undefined) delete process.env.BUILT_IN_FORGE_API_URL;
  else process.env.BUILT_IN_FORGE_API_URL = env.url;
  if (env.key === undefined) delete process.env.BUILT_IN_FORGE_API_KEY;
  else process.env.BUILT_IN_FORGE_API_KEY = env.key;
  if (env.model === undefined) delete process.env.BUILT_IN_FORGE_API_MODEL;
  else process.env.BUILT_IN_FORGE_API_MODEL = env.model;

  const captured: Captured = {};
  stubFetch(captured);
  const { invokeLLM } = await import("./_core/llm");
  await invokeLLM({ messages: [{ role: "user", content: "hi" }] as any });
  return captured;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BUILT_IN_FORGE_API_URL;
  delete process.env.BUILT_IN_FORGE_API_KEY;
  delete process.env.BUILT_IN_FORGE_API_MODEL;
});

describe("LLM endpoint configuration", () => {
  it("appends /v1/chat/completions to a host base (OpenAI-style)", async () => {
    const c = await invokeWith({ url: "https://api.openai.com", key: "sk-x" });
    expect(c.url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("accepts a full endpoint path unchanged (Gemini OpenAI-compatible)", async () => {
    const c = await invokeWith({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: "AIza-x",
    });
    expect(c.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(c.url).not.toContain("/v1/v1");
  });

  it("tolerates a trailing slash on the configured full path", async () => {
    const c = await invokeWith({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions/",
      key: "AIza-x",
    });
    expect(c.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
  });

  it("defaults the model to gemini-2.5-flash", async () => {
    const c = await invokeWith({ url: "https://api.openai.com", key: "sk-x" });
    expect(c.body.model).toBe("gemini-2.5-flash");
  });

  it("honours BUILT_IN_FORGE_API_MODEL when set", async () => {
    const c = await invokeWith({
      url: "https://api.openai.com",
      key: "sk-x",
      model: "llama3.1:8b",
    });
    expect(c.body.model).toBe("llama3.1:8b");
  });

  it("still fails fast and honestly when no endpoint is configured", async () => {
    vi.resetModules();
    delete process.env.BUILT_IN_FORGE_API_URL;
    process.env.BUILT_IN_FORGE_API_KEY = "key-but-no-endpoint";
    const { invokeLLM } = await import("./_core/llm");
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hi" }] as any }),
    ).rejects.toThrow(/LLM endpoint is not configured/);
  });
});
