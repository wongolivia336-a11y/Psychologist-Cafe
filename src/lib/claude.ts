import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY 未设置。复制 .env.example 为 .env.local 并填入 key。",
    );
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const MODEL = process.env.CAFE_MODEL ?? "claude-opus-5";
