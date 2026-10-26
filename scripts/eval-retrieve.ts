/**
 * 检索质量评测：npm run eval
 *
 * 对 eval/husserl-gold.json 里的每个提问跑三种配置，按 § 区间判定命中：
 *   bm25          只做词面匹配（关掉跨语言扩展）
 *   bm25+expand   线上配置
 *   hybrid        BM25 + 向量（需要 VOYAGE_API_KEY 且索引带向量，否则跳过）
 *
 * 指标：hit@1 / hit@3 / hit@5（前 k 条里至少一条落在黄金区间）与 MRR@5。
 * 同时给出「随机基线」——黄金区间越大，瞎猜也越容易中，不看这个数字没法判断
 * 检索到底有没有在工作。
 *
 * 选项：--verbose 逐条打印；--json 输出机器可读结果（测试用）。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadIndex, retrieve } from "../src/lib/rag/retrieve";
import { embeddingsEnabled } from "../src/lib/rag/embeddings";
import { parseLabel } from "../src/lib/rag/sections";
import type { IndexedChunk } from "../src/lib/rag/types";

type GoldRange = { unit: string; from: number; to: number };
type GoldQuery = { kind: "concept" | "table"; q: string; gold: GoldRange[]; note?: string };
type GoldFile = { source: string; topK: number; queries: GoldQuery[] };

type Config = { name: string; expand: boolean; needsVectors?: boolean };
const CONFIGS: Config[] = [
  { name: "bm25", expand: false },
  { name: "bm25+expand", expand: true },
  { name: "hybrid", expand: true, needsVectors: true },
];

export type QueryResult = { q: string; kind: string; rank: number | null; goldSize: number };
export type ConfigResult = {
  name: string;
  ran: boolean;
  n: number;
  hit1: number;
  hit3: number;
  hit5: number;
  mrr: number;
  randomHit5: number;
  perQuery: QueryResult[];
};

function inGold(chunk: IndexedChunk, gold: GoldRange[]): boolean {
  const l = parseLabel(chunk.section);
  if (!l) return false;
  return gold.some((g) => g.unit === l.unit && l.section >= g.from && l.section <= g.to);
}

export async function runEval(goldPath: string): Promise<{
  results: ConfigResult[];
  corpusSize: number;
}> {
  const gold = JSON.parse(await readFile(goldPath, "utf8")) as GoldFile;
  const index = await loadIndex();
  const pool = index.chunks.filter((c) => c.philosopher === gold.source);
  const byId = new Map(pool.map((c) => [c.id, c]));
  const topK = gold.topK ?? 5;
  const vectorsReady = embeddingsEnabled() && Boolean(index.embedModel);

  const results: ConfigResult[] = [];
  for (const cfg of CONFIGS) {
    if (cfg.needsVectors && !vectorsReady) {
      results.push({ name: cfg.name, ran: false, n: 0, hit1: 0, hit3: 0, hit5: 0, mrr: 0, randomHit5: 0, perQuery: [] });
      continue;
    }
    const perQuery: QueryResult[] = [];
    for (const item of gold.queries) {
      const hits = await retrieve(item.q, { philosophers: [gold.source], topK, expand: cfg.expand });
      let rank: number | null = null;
      hits.forEach((h, i) => {
        if (rank === null && inGold(byId.get(h.id)!, item.gold)) rank = i + 1;
      });
      const goldSize = pool.filter((c) => inGold(c, item.gold)).length;
      perQuery.push({ q: item.q, kind: item.kind, rank, goldSize });
    }
    const scored = perQuery.filter((p) => p.kind === "concept");
    const n = scored.length;
    const at = (k: number) => scored.filter((p) => p.rank !== null && p.rank <= k).length / n;
    const mrr = scored.reduce((s, p) => s + (p.rank ? 1 / p.rank : 0), 0) / n;
    const randomHit5 =
      scored.reduce((s, p) => s + (1 - Math.pow(1 - p.goldSize / pool.length, topK)), 0) / n;
    results.push({ name: cfg.name, ran: true, n, hit1: at(1), hit3: at(3), hit5: at(topK), mrr, randomHit5, perQuery });
  }
  return { results, corpusSize: pool.length };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

async function main() {
  const verbose = process.argv.includes("--verbose");
  const asJson = process.argv.includes("--json");
  const goldPath = path.resolve(import.meta.dirname, "..", "eval", "husserl-gold.json");
  const { results, corpusSize } = await runEval(goldPath);

  if (asJson) {
    console.log(JSON.stringify({ corpusSize, results: results.map(({ perQuery: _p, ...r }) => r) }));
    return;
  }

  const ran = results.filter((r) => r.ran);
  console.log(`语料：${corpusSize} 块 · 计分提问：${ran[0]?.n ?? 0} 条 · topK=5\n`);
  console.log("| 配置 | hit@1 | hit@3 | hit@5 | MRR@5 | 随机基线 hit@5 |");
  console.log("| :-- | --: | --: | --: | --: | --: |");
  for (const r of results) {
    if (!r.ran) {
      console.log(`| ${r.name} | — | — | — | — | 未跑（需要 VOYAGE_API_KEY 并重建索引） |`);
      continue;
    }
    console.log(`| ${r.name} | ${pct(r.hit1)} | ${pct(r.hit3)} | ${pct(r.hit5)} | ${r.mrr.toFixed(2)} | ${pct(r.randomHit5)} |`);
  }

  if (verbose) {
    for (const r of ran) {
      console.log(`\n── ${r.name} ──`);
      for (const p of r.perQuery) {
        const tag = p.kind === "table" ? "参考" : "计分";
        console.log(`  ${p.rank ? `#${p.rank}` : " ✗"}  [${tag}] ${p.q}  (黄金 ${p.goldSize} 块)`);
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
