export type ClientChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_CONTEXT_CHARACTERS = 6_000;

/**
 * The browser owns no trusted assistant identity. Keep only recent user text,
 * as a bounded normal user turn, before passing it to a model provider.
 */
export function userConversation(messages: ClientChatMessage[]): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);

  let remaining = MAX_CONTEXT_CHARACTERS;
  const selected: string[] = [];
  for (let index = userMessages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = userMessages[index];
    const portion = message.slice(Math.max(0, message.length - remaining));
    selected.unshift(portion);
    remaining -= portion.length + 2;
  }
  return selected.join("\n\n");
}

export const CHAT_CONTEXT_LIMIT = MAX_CONTEXT_CHARACTERS;
