/**
 * 把 data/corpus/ 下的语料构建成检索索引 data/index.json。
 *
 *   npm run index
 *
 * 三类语料一视同仁地进索引，靠 meta.license 区分：
 *   sources/   公有领域原著（npm run fetch 下载）      license: public-domain
 *   cards/     人工撰写的概念卡片                      license: original-summary
 *   licensed/  你自行合法获取的文本（已 gitignore）    license: licensed-private
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chunkCard, chunkSource } from "../src/lib/rag/chunk";
import { tokenize, termFreq } from "../src/lib/rag/tokenize";
import { embedDocuments, embeddingsEnabled, EMBED_MODEL } from "../src/lib/rag/embeddings";
import type { Chunk, CorpusIndex, IndexedChunk } from "../src/lib/rag/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const CORPUS = path.join(ROOT, "data", "corpus");

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function collect(): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  // 1. 概念卡片
  const cardDir = path.join(CORPUS, "cards");
  for (const f of await readDirSafe(cardDir)) {
    if (!f.endsWith(".md")) continue;
    const raw = await readFile(path.join(cardDir, f), "utf8");
    const got = chunkCard(raw, path.basename(f, ".md"));
    chunks.push(...got);
    console.log(`  卡片 ${f}: ${got.length} 块`);
  }

  // 2. 公有领域原著
  const srcDir = path.join(CORPUS, "sources");
  for (const f of await readDirSafe(srcDir)) {
    if (!f.endsWith(".txt")) continue;
    const raw = await readFile(path.join(srcDir, f), "utf8");
    const got = chunkSource(raw, path.basename(f, ".txt"));

    // 护栏：这类故障（CRLF 打断切分、frontmatter 解析失败）不会抛异常，
    // 只会静默产出一个废索引。用「每块平均字数」把它变成硬失败。
    const avg = got.length ? raw.length / got.length : Infinity;
    if (avg > 6000) {
      throw new Error(
        `${f} 只切出 ${got.length} 块（平均 ${Math.round(avg)} 字/块），明显异常。\n` +
          `多半是换行符或 frontmatter 没解析对，索引会是废的。检查 .gitattributes 与 chunk.ts。`,
      );
    }
    if (got.length && got.every((c) => c.meta.license === "unknown")) {
      throw new Error(`${f} 的 frontmatter 没解析出 license，元数据全丢，检查文件头格式。`);
    }

    chunks.push(...got);
    console.log(`  原著 ${f}: ${got.length} 块`);
  }

  // 3. 自备授权文本
  const licDir = path.join(CORPUS, "licensed");
  for (const f of await readDirSafe(licDir)) {
    if (!f.endsWith(".txt") && !f.endsWith(".md")) continue;
    const raw = await readFile(path.join(licDir, f), "utf8");
    const id = path.basename(f, path.extname(f));
    const got = f.endsWith(".md") ? chunkCard(raw, id) : chunkSource(raw, id);
    for (const c of got) c.meta.license = "licensed-private";
    chunks.push(...got);
    console.log(`  授权 ${f}: ${got.length} 块`);
  }

  return chunks;
}

async function main() {
  console.log("扫描语料…");
  const chunks = await collect();

  if (chunks.length === 0) {
    console.error(
      "\n没有找到任何语料。先运行 npm run fetch 下载公有领域原著，\n" +
        "或在 data/corpus/cards/ 放入概念卡片。",
    );
    process.exit(1);
  }

  console.log(`\n合计 ${chunks.length} 块，建立 BM25 统计…`);

  const df: Record<string, number> = {};
  let totalLen = 0;

  const indexed: IndexedChunk[] = chunks.map((c) => {
    // 标题和标签参与检索，权重靠重复计入实现（简单有效）
    const tokens = tokenize(
      [c.section, c.tags.join(" "), c.tags.join(" "), c.text].join("\n"),
    );
    const tf = termFreq(tokens);
    for (const term of Object.keys(tf)) df[term] = (df[term] ?? 0) + 1;
    totalLen += tokens.length;
    return { ...c, tf, len: tokens.length };
  });

  const index: CorpusIndex = {
    version: 1,
    builtAt: new Date().toISOString(),
    embedModel: null,
    chunks: indexed,
    df,
    avgdl: totalLen / indexed.length,
    n: indexed.length,
  };

  if (embeddingsEnabled()) {
    console.log(`\n检测到 VOYAGE_API_KEY，生成向量（${EMBED_MODEL}）…`);
    try {
      const vecs = await embedDocuments(
        indexed.map((c) => `${c.section}\n${c.text}`),
        (done, total) => process.stdout.write(`\r  ${done}/${total}`),
      );
      vecs.forEach((v, i) => (indexed[i].vec = v));
      index.embedModel = EMBED_MODEL;
      console.log("\n  ✓ 向量完成，检索启用 BM25 + 向量混合（RRF）");
    } catch (err) {
      console.warn(`\n  ⚠ 向量生成失败，退回纯 BM25：${(err as Error).message}`);
    }
  } else {
    console.log("\n未设置 VOYAGE_API_KEY —— 使用纯 BM25 检索（功能完整）。");
  }

  await mkdir(path.join(ROOT, "data"), { recursive: true });
  const out = path.join(ROOT, "data", "index.json");
  await writeFile(out, JSON.stringify(index), "utf8");

  const kb = (Buffer.byteLength(JSON.stringify(index)) / 1024 / 1024).toFixed(1);
  console.log(`\n索引写入 data/index.json（${kb} MB，${index.n} 块，词表 ${Object.keys(df).length}）`);

  // 按哲学家和许可类型汇总，方便核对语料构成
  const byPhil = new Map<string, number>();
  const byLic = new Map<string, number>();
  for (const c of indexed) {
    byPhil.set(c.philosopher, (byPhil.get(c.philosopher) ?? 0) + 1);
    byLic.set(c.meta.license, (byLic.get(c.meta.license) ?? 0) + 1);
  }
  console.log("  按哲学家：", [...byPhil].map(([k, v]) => `${k}=${v}`).join("  "));
  console.log("  按许可：  ", [...byLic].map(([k, v]) => `${k}=${v}`).join("  "));
}

main();
