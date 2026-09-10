import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string };
export type Tool = { type: "function"; function: { name: string; description?: string; parameters?: Record<string, unknown> } };
export type ToolChoice = "none" | "auto" | "required" | { name: string } | { type: "function"; function: { name: string } };
export type OutputSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type ResponseFormat = { type: "text" } | { type: "json_object" } | { type: "json_schema"; json_schema: OutputSchema };
export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: Role; content: string | Array<TextContent | ImageContent | FileContent>; tool_calls?: ToolCall[] }; finish_reason: string | null }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function normalizeContent(content: MessageContent | MessageContent[]): unknown {
  const parts = (Array.isArray(content) ? content : [content]).map((part) => {
    if (typeof part === "string") return { type: "text", text: part };
    return part;
  });
  return parts.length === 1 && (parts[0] as { type?: string }).type === "text"
    ? (parts[0] as TextContent).text
    : parts;
}

function normalizeMessage(message: Message) {
  return {
    role: message.role,
    ...(message.name ? { name: message.name } : {}),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    content: typeof message.content === "string" || message.role === "tool" || message.role === "function"
      ? Array.isArray(message.content)
        ? message.content.map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n")
        : message.content
      : normalizeContent(message.content),
  };
}

function normalizeToolChoice(choice: ToolChoice | undefined, tools: Tool[] | undefined): unknown {
  if (!choice || choice === "none" || choice === "auto") return choice;
  if (choice === "required") {
    if (!tools?.length) throw new Error("tool_choice 'required' was provided but no tools were configured");
    if (tools.length > 1) throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in choice) return { type: "function", function: { name: choice.name } };
  return choice;
}

function normalizeResponseFormat(params: InvokeParams): ResponseFormat | undefined {
  const explicit = params.responseFormat ?? params.response_format;
  if (explicit) return explicit;
  const schema = params.outputSchema ?? params.output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema) throw new Error("outputSchema requires both name and schema");
  return { type: "json_schema", json_schema: schema };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured");
  const payload: Record<string, unknown> = {
    model: ENV.openAiModel,
    messages: params.messages.map(normalizeMessage),
  };
  if (params.tools?.length) payload.tools = params.tools;
  const toolChoice = normalizeToolChoice(params.toolChoice ?? params.tool_choice, params.tools);
  if (toolChoice) payload.tool_choice = toolChoice;
  const maxTokens = params.maxTokens ?? params.max_tokens;
  if (maxTokens !== undefined) payload.max_tokens = maxTokens;
  const responseFormat = normalizeResponseFormat(params);
  if (responseFormat) payload.response_format = responseFormat;

  const response = await fetch(`${ENV.openAiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openAiApiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${await response.text()}`);
  }
  return (await response.json()) as InvokeResult;
}
