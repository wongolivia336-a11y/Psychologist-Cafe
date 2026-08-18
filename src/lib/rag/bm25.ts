import type { CorpusIndex, IndexedChunk } from "./types";
import { tokenize } from "./tokenize";

const K1 = 1.2;
const B = 0.75;

/**
 * 标准 BM25。零依赖、零外部调用，语料换了立刻生效。
 * 它是本项目检索的保底层：没有 VOYAGE_API_KEY 也能完整跑通。
 */
export function bm25Search(
  index: CorpusIndex,
  query: string,
  opts: { topK?: number; filter?: (c: IndexedChunk) => boolean } = {},
): { chunk: IndexedChunk; score: number }[] {
  const topK = opts.topK ?? 8;
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0) return [];

  const pool = opts.filter ? index.chunks.filter(opts.filter) : index.chunks;
  const scored: { chunk: IndexedChunk; score: number }[] = [];

  for (const chunk of pool) {
    let score = 0;
    for (const term of qTerms) {
      const f = chunk.tf[term];
      if (!f) continue;
      const df = index.df[term] ?? 0;
      // 加一平滑的 IDF，避免 df 为 0 时出现负值
      const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
      const norm = f * (K1 + 1);
      const denom = f + K1 * (1 - B + (B * chunk.len) / index.avgdl);
      score += idf * (norm / denom);
    }
    if (score > 0) scored.push({ chunk, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
