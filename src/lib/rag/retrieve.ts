import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CorpusIndex, IndexedChunk, Retrieved } from "./types";
import { bm25Search } from "./bm25";
import { cosine, embedQuery, embeddingsEnabled } from "./embeddings";
import { expandQuery } from "./expand";

let cached: CorpusIndex | null = null;

export async function loadIndex(): Promise<CorpusIndex> {
  if (cached) return cached;

  // serverless 环境（Vercel）里 cwd 不一定是项目根，多试几个位置。
  // 索引本体由 next.config.ts 的 outputFileTracingIncludes 打进函数包。
  const candidates = [
    path.join(process.cwd(), "data", "index.json"),
    path.join(process.cwd(), ".next", "server", "data", "index.json"),
    path.resolve("data", "index.json"),
  ];

  const errors: string[] = [];
  for (const file of candidates) {
    try {
      cached = JSON.parse(await readFile(file, "utf8")) as CorpusIndex;
      return cached;
    } catch (err) {
      errors.push(`${file}: ${(err as Error).message}`);
    }
  }

  throw new Error(
    "找不到检索索引 data/index.json。本地请先运行 npm run index。\n" +
      errors.join("\n"),
  );
}

/** 仅供测试/脚本使用：清掉进程内缓存 */
export function clearIndexCache() {
  cached = null;
}

/**
 * 倒数排名融合（Reciprocal Rank Fusion）。
 * 比分数加权更稳：BM25 和余弦相似度的量纲完全不同，直接加权需要调参，
 * 而 RRF 只看排名，换语料、换 embedding 模型都不用重调。
 */
function rrf(
  lists: { key: string; ranked: IndexedChunk[] }[],
  k = 60,
): Map<string, { chunk: IndexedChunk; score: number; via: Set<string> }> {
  const merged = new Map<
    string,
    { chunk: IndexedChunk; score: number; via: Set<string> }
  >();

  for (const { key, ranked } of lists) {
    ranked.forEach((chunk, i) => {
      const cur = merged.get(chunk.id) ?? {
        chunk,
        score: 0,
        via: new Set<string>(),
      };
      cur.score += 1 / (k + i + 1);
      cur.via.add(key);
      merged.set(chunk.id, cur);
    });
  }
  return merged;
}

export type RetrieveOptions = {
  /** 只在这些哲学家的语料里检索。空/未传 = 全部。 */
  philosophers?: string[];
  topK?: number;
  /** 每路召回的候选数，融合后再截断到 topK */
  candidates?: number;
  /** 是否做跨语言查询扩展。默认开；评测脚本关掉它来量化扩展的贡献。 */
  expand?: boolean;
};

export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
): Promise<Retrieved[]> {
  const index = await loadIndex();
  const topK = opts.topK ?? 6;
  const candidates = opts.candidates ?? 24;

  const allow = opts.philosophers?.length ? new Set(opts.philosophers) : null;
  const filter = allow ? (c: IndexedChunk) => allow.has(c.philosopher) : undefined;

  // 跨语言扩展：中文提问对德文原著是零词面命中，先把查询扩到语料的语言。
  // 只影响 BM25；向量本身是多语言的，用原查询即可。
  const langs = [
    ...new Set((filter ? index.chunks.filter(filter) : index.chunks).map((c) => c.meta.lang)),
  ];
  const expanded = opts.expand === false ? query : expandQuery(query, langs);

  // 第一路：BM25
  const lexical = bm25Search(index, expanded, { topK: candidates, filter });
  const lists: { key: string; ranked: IndexedChunk[] }[] = [
    { key: "bm25", ranked: lexical.map((r) => r.chunk) },
  ];

  // 第二路：向量（可选）
  if (embeddingsEnabled() && index.embedModel) {
    const qvec = await embedQuery(query);
    if (qvec) {
      const pool = filter ? index.chunks.filter(filter) : index.chunks;
      const scored = pool
        .filter((c) => c.vec?.length)
        .map((c) => ({ chunk: c, score: cosine(qvec, c.vec!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, candidates);
      if (scored.length) {
        lists.push({ key: "vector", ranked: scored.map((s) => s.chunk) });
      }
    }
  }

  const merged = rrf(lists);

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score, via }) => {
      // 不把 tf/vec 这些索引内部字段带到调用方
      const { tf: _tf, len: _len, vec: _vec, ...rest } = chunk;
      return { ...rest, score, via: [...via] as ("bm25" | "vector")[] };
    });
}
