/**
 * 下载 data/sources.json 里 active 的公有领域原著到 data/corpus/sources/。
 * 只做「取回 + 去壳 + 记录出处」，不做任何改写。
 *
 *   npm run fetch
 */
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "corpus", "sources");

type Strip = { kind: "gutenberg" | "archive-djvu" | "none"; from?: string; to?: string };
type Source = {
  id: string;
  philosopher: string;
  title: string;
  author: string;
  translator?: string;
  year: number;
  lang: string;
  license: string;
  licenseNote?: string;
  url: string;
  sourcePage: string;
  active: boolean;
  optional?: boolean;
  note?: string;
  strip?: Strip;
};

/** 去掉 Project Gutenberg 的页眉页脚法律声明，只留正文。 */
function stripGutenberg(raw: string, from?: string, to?: string): string {
  let text = raw;
  const start = text.match(/\*\*\*\s*START OF TH(E|IS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (start?.index !== undefined) text = text.slice(start.index + start[0].length);
  const end = text.match(/\*\*\*\s*END OF TH(E|IS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (end?.index !== undefined) text = text.slice(0, end.index);

  if (from) {
    const i = text.indexOf(from);
    if (i >= 0) text = text.slice(i);
    else console.warn(`  ! 未找到起始标记 "${from}"，保留全文`);
  }
  if (to) {
    const j = text.indexOf(to);
    if (j >= 0) text = text.slice(0, j);
    else console.warn(`  ! 未找到结束标记 "${to}"，保留到末尾`);
  }
  return text;
}

/**
 * archive.org 的 _djvu.txt 是扫描件 OCR，带页眉页码和硬换行。
 * 这里只做保守清理：不修字、不猜词，只合并被硬换行切断的段落。
 */
function stripArchiveDjvu(raw: string): string {
  return raw
    // 去掉独占一行的纯页码
    .replace(/^[ \t]*[0-9ivxlcIVXLC]{1,6}[ \t]*$/gm, "")
    // 行尾连字符断词：Untersu-\nchung -> Untersuchung
    .replace(/([A-Za-zÄÖÜäöüß])-\n([a-zäöüß])/g, "$1$2")
    // 段内硬换行合并为空格；连续空行（真正的段落边界）保留
    .replace(/([^\n])\n(?!\n)([^\n])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

async function fetchWithRetry(url: string, tries = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "philosopher-cafe/0.1 (research prototype)" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < tries) {
        console.warn(`  重试 ${i}/${tries - 1}: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  }
  throw lastErr;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(
    await readFile(path.join(ROOT, "data", "sources.json"), "utf8"),
  ) as { sources: Source[] };

  const active = manifest.sources.filter((s) => s.active && s.url);
  console.log(`语料源：${active.length} 个待下载\n`);

  let ok = 0;
  const failed: string[] = [];

  for (const s of active) {
    const outPath = path.join(OUT_DIR, `${s.id}.txt`);
    try {
      const existing = await stat(outPath).catch(() => null);
      if (existing && existing.size > 1000) {
        console.log(`· ${s.id} 已存在（${(existing.size / 1024).toFixed(0)}KB），跳过`);
        ok++;
        continue;
      }

      console.log(`↓ ${s.id}  ${s.title}`);
      const raw = await fetchWithRetry(s.url);

      const kind = s.strip?.kind ?? "none";
      const body =
        kind === "gutenberg"
          ? stripGutenberg(raw, s.strip?.from, s.strip?.to)
          : kind === "archive-djvu"
            ? stripArchiveDjvu(raw)
            : raw;

      // 出处头：让每一段检索结果都能回溯到真实来源
      const header = [
        "---",
        `source_id: ${s.id}`,
        `philosopher: ${s.philosopher}`,
        `title: ${JSON.stringify(s.title)}`,
        `author: ${JSON.stringify(s.author)}`,
        s.translator ? `translator: ${JSON.stringify(s.translator)}` : null,
        `year: ${s.year}`,
        `lang: ${s.lang}`,
        `license: ${s.license}`,
        s.licenseNote ? `license_note: ${JSON.stringify(s.licenseNote)}` : null,
        `url: ${s.url}`,
        `source_page: ${s.sourcePage}`,
        `fetched_at: ${new Date().toISOString()}`,
        "---",
        "",
      ]
        // 只丢掉缺省字段（null），不能用 filter(Boolean)——那会把结尾的空行也吃掉，
        // 导致 "---" 和正文首行黏在一起。
        .filter((line) => line !== null)
        .join("\n");

      await writeFile(outPath, header + body.trim() + "\n", "utf8");
      console.log(`  ✓ ${(Buffer.byteLength(body) / 1024).toFixed(0)}KB -> ${path.relative(ROOT, outPath)}`);
      ok++;
    } catch (err) {
      const msg = (err as Error).message;
      if (s.optional) {
        console.warn(`  ⚠ ${s.id} 可选源失败，忽略：${msg}`);
      } else {
        console.error(`  ✗ ${s.id} 失败：${msg}`);
        failed.push(s.id);
      }
    }
  }

  console.log(`\n完成：${ok}/${active.length}`);
  if (failed.length) {
    console.error(`必需源失败：${failed.join(", ")}`);
    process.exit(1);
  }
}

main();
