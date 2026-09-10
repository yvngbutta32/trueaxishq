import { ENV } from "./env";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

/** Call an explicitly configured external data API without a platform proxy. */
export async function callDataApi(apiId: string, options: DataApiCallOptions = {}): Promise<unknown> {
  if (!ENV.dataApiBaseUrl) throw new Error("DATA_API_BASE_URL is not configured");
  const url = new URL(apiId, `${ENV.dataApiBaseUrl.replace(/\/+$/, "")}/`);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    method: options.body || options.formData ? "POST" : "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(ENV.dataApiKey ? { authorization: `Bearer ${ENV.dataApiKey}` } : {}),
    },
    body: options.body || options.formData
      ? JSON.stringify({ ...options.body, ...options.formData, pathParams: options.pathParams })
      : undefined,
  });
  if (!response.ok) throw new Error(`Data API request failed (${response.status} ${response.statusText})`);
  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === "object" && "jsonData" in payload) {
    try { return JSON.parse((payload as Record<string, string>).jsonData ?? "{}"); } catch { return payload.jsonData; }
  }
  return payload;
}
