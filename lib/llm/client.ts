/**
 * LLM client — thin wrapper over the OpenAI SDK.
 * All LLM calls go through here so the provider can be swapped at one site.
 */
import OpenAI from "openai";
import { config } from "@/lib/config";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Lazily initialised so the module can be imported without throwing at build time
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: config.llm.openaiApiKey });
  }
  return _client;
}

/**
 * Generate a chat completion.
 * Throws on failure — callers should handle or let Inngest retry.
 */
export async function generate(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const {
    model = config.llm.model,
    temperature = 0.3,
    maxTokens,
    responseFormat = "text",
  } = options;

  const completion = await getClient().chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format:
      responseFormat === "json_object" ? { type: "json_object" } : { type: "text" },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const choice = completion.choices[0];
  if (!choice?.message?.content) {
    throw new Error(`LLM returned no content (model: ${model})`);
  }

  return {
    content: choice.message.content,
    usage: completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined,
  };
}
