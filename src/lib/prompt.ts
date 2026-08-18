import type { Retrieved } from "./rag/types";
import type { Persona } from "./personas";
import { SHARED_FRAME } from "./personas";

export type DishContext = {
  /** /api/dish 识别出的菜品要素 */
  items: string[];
  colors: string[];
  temperature?: string;
  note?: string;
} | null;

export type MemoryContext = {
  /** 用户放在桌上的记忆物件 */
  object: string;
  label: string;
} | null;

/** 把检索到的原文拼成可引用的上下文块，带出处，便于模型如实引用、前端如实标注。 */
export function formatSources(chunks: Retrieved[]): string {
  if (!chunks.length) return "（本轮没有检索到相关原文。就用你自己的话说，不要杜撰引文。）";

  return chunks
    .map((c, i) => {
      const provenance =
        c.meta.license === "public-domain"
          ? `${c.meta.author}《${c.meta.title}》${c.meta.year ?? ""}，公有领域原文`
          : c.meta.license === "original-summary"
            ? `${c.meta.author} 概念卡片（非原著节录，不可作为引文出处）`
            : `${c.meta.title}（自备授权文本）`;
      return `[${i + 1}] ${provenance}\n定位：${c.section}\n${c.text}`;
    })
    .join("\n\n---\n\n");
}

export function buildSystem(
  persona: Persona,
  sources: Retrieved[],
  dish: DishContext,
  memory: MemoryContext,
  softNote?: string,
): { text: string; cache: boolean }[] {
  // 稳定部分放前面并打缓存标记：人格与框架每轮都一样，不该重复计费。
  const stable = `${SHARED_FRAME}\n\n${persona.system}`;

  const situational: string[] = [];

  if (dish?.items?.length) {
    situational.push(
      `## 桌上这一份\n对方拍下的食物里有：${dish.items.join("、")}。` +
        (dish.colors?.length ? `\n主要的颜色是：${dish.colors.join("、")}。` : "") +
        (dish.temperature ? `\n看起来是${dish.temperature}的。` : "") +
        `\n你看得见它。可以从它开始说，但不要评价它。`,
    );
  }

  if (memory) {
    situational.push(
      `## 桌上的物件\n对方在桌上放了一件东西：${memory.object}${
        memory.label ? `（他给它的说明：「${memory.label}」）` : ""
      }。\n` +
        `重要：对着这件物件说话，不要对着他说话。不要问"这代表什么"、不要问"这是谁给你的"。\n` +
        `就当它是一个摆在面前的东西，描述它、好奇它。他想说的时候自己会说。`,
    );
  }

  situational.push(`## 你的著作里检索到的相关段落\n${formatSources(sources)}`);

  if (softNote) situational.push(softNote);

  return [
    { text: stable, cache: true },
    { text: situational.join("\n\n"), cache: false },
  ];
}
