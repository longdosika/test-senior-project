import { ProviderError } from "./errors";

export interface AiProvider {
  summarize(text: string): Promise<string>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Anthropic Messages API adapter. Requires ANTHROPIC_API_KEY. */
export class AnthropicAiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: { apiKey: string; model: string; fetch?: FetchLike }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  async summarize(text: string): Promise<string> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `สรุปข้อความต่อไปนี้ให้กระชับ ใช้ภาษาเดียวกับข้อความต้นฉบับ:\n\n${text}`,
          },
        ],
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } }
      | null;
    if (!res.ok) {
      throw new ProviderError(`Anthropic request failed: ${json?.error?.message ?? `HTTP ${res.status}`}`);
    }
    const summary = (json?.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!summary) throw new ProviderError("Anthropic returned an empty summary");
    return summary;
  }
}
