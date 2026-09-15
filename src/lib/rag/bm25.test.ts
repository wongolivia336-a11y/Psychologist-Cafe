import { describe, expect, it } from "vitest";
import { bm25Search } from "./bm25";
import { termFreq, tokenize } from "./tokenize";
import type { CorpusIndex, IndexedChunk } from "./types";

/** 用几段文字现场搭一个迷你索引，和 build-index.ts 的统计方式一致 */
function build(docs: string[]): CorpusIndex {
  const df: Record<string, number> = {};
  let total = 0;
  const chunks: IndexedChunk[] = docs.map((text, i) => {
    const tokens = tokenize(text);
    const tf = termFreq(tokens);
    for (const t of Object.keys(tf)) df[t] = (df[t] ?? 0) + 1;
    total += tokens.length;
    return {
      id: `d${i}`,
      philosopher: i === 3 ? "other" : "husserl",
      section: `s${i}`,
      text,
      tags: [],
      meta: { sourceId: "t", title: "t", author: "t", lang: "de", license: "public-domain" },
      tf,
      len: tokens.length,
    };
  });
  return { version: 1, builtAt: "", embedModel: null, chunks, df, avgdl: total / chunks.length, n: chunks.length };
}

const index = build([
  "Die Evidenz ist das Erlebnis der Wahrheit.",
  "Von der Anschauung zur Erfüllung der Bedeutungsintention.",
  "Der Satz vom Widerspruch in psychologischer Interpretation.",
  "Evidenz Evidenz Evidenz — ein anderer Philosoph.",
]);

describe("bm25Search", () => {
  it("命中查询词的文档排在前面", () => {
    const hits = bm25Search(index, "Widerspruch");
    expect(hits[0].chunk.id).toBe("d2");
  });

  it("查询里全是停用词时返回空", () => {
    expect(bm25Search(index, "der die das")).toEqual([]);
  });

  it("filter 只在允许的文档里检索", () => {
    const hits = bm25Search(index, "Evidenz", { filter: (c) => c.philosopher === "husserl" });
    expect(hits.map((h) => h.chunk.id)).not.toContain("d3");
    expect(hits[0].chunk.id).toBe("d0");
  });

  it("topK 截断", () => {
    expect(bm25Search(index, "Evidenz Anschauung Widerspruch", { topK: 2 })).toHaveLength(2);
  });

  it("大小写不敏感", () => {
    const a = bm25Search(index, "evidenz").map((h) => h.chunk.id);
    const b = bm25Search(index, "EVIDENZ").map((h) => h.chunk.id);
    expect(a).toEqual(b);
  });
});
