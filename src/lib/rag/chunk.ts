import type { Chunk, ChunkMeta } from "./types";

/**
 * 统一换行符。
 *
 * 必须做，不是洁癖：Windows 上 git 检出会把语料换成 CRLF，而
 *   - JS 正则里 `.` 不匹配 `\r`，`$`（无 m 标志）只匹配串尾，
 *     导致 frontmatter 的 `key: value$` 每行都匹配失败，元数据全丢；
 *   - 段落分隔 `\r\n\r\n` 过不了 `/\n{2,}/`，整份原著会被切成一块。
 * 两者都不报错，只是静默产出一个废索引。
 */
function normalizeEol(raw: string): string {
  return raw.replace(/\r\n?/g, "\n");
}

/** 解析文件顶部的 `---` frontmatter，返回键值对与剩余正文。 */
export function parseFrontmatter(input: string): {
  meta: Record<string, string>;
  body: string;
} {
  const raw = normalizeEol(input);
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: raw };

  const head = raw.slice(3, end);
  const body = raw.slice(end + 4);
  const meta: Record<string, string> = {};

  for (const line of head.split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) {
      try {
        v = JSON.parse(v) as string;
      } catch {
        v = v.slice(1, -1);
      }
    }
    meta[m[1]] = v;
  }
  return { meta, body };
}

function metaFrom(fm: Record<string, string>, fallbackId: string): ChunkMeta {
  return {
    sourceId: fm.source_id ?? fallbackId,
    title: fm.title ?? fm.name ?? fallbackId,
    author: fm.author ?? fm.name ?? "",
    translator: fm.translator || undefined,
    year: fm.year ? Number(fm.year) : undefined,
    lang: fm.lang ?? "zh",
    license: fm.license ?? "unknown",
    url: fm.url || undefined,
    sourcePage: fm.source_page || undefined,
  };
}

/**
 * 概念卡片（data/corpus/cards/*.md）：按 `## 标题` 切块，
 * 标题下紧跟的 `tags:` 行作为标签。一块 = 一个完整概念，语义边界天然干净。
 */
export function chunkCard(raw: string, fileId: string): Chunk[] {
  const { meta: fm, body } = parseFrontmatter(raw);
  const philosopher = fm.philosopher ?? fileId;
  const meta = metaFrom(fm, `card:${philosopher}`);

  const out: Chunk[] = [];
  const parts = body.split(/^##\s+/m).slice(1);

  parts.forEach((part, i) => {
    const nl = part.indexOf("\n");
    const section = (nl < 0 ? part : part.slice(0, nl)).trim();
    let rest = nl < 0 ? "" : part.slice(nl + 1);

    let tags: string[] = [];
    const tagLine = rest.match(/^\s*tags:\s*(.+)$/m);
    if (tagLine) {
      tags = tagLine[1].split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      rest = rest.replace(tagLine[0], "");
    }

    const text = rest.trim();
    if (!text) return;

    out.push({
      id: `${philosopher}-card-${i}`,
      philosopher,
      section,
      text,
      tags,
      meta: { ...meta, license: fm.license ?? "original-summary" },
    });
  });

  return out;
}

/**
 * 原著全文（data/corpus/sources/*.txt）：按段落聚合成约 `target` 字的窗口，
 * 带 `overlap` 字重叠，避免概念被切在边界上。
 * 不在句中硬切——宁可块大小不均，也不要产出半句话喂给模型。
 */
export function chunkSource(
  raw: string,
  fileId: string,
  opts: { target?: number; overlap?: number; minChars?: number } = {},
): Chunk[] {
  const target = opts.target ?? 900;
  const overlap = opts.overlap ?? 150;
  const minChars = opts.minChars ?? 120;

  const { meta: fm, body } = parseFrontmatter(raw);
  const philosopher = fm.philosopher ?? fileId;
  const meta = metaFrom(fm, fileId);

  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 24);

  const out: Chunk[] = [];
  let buf = "";
  let idx = 0;

  const push = () => {
    const text = buf.trim();
    if (text.length >= minChars) {
      out.push({
        id: `${fileId}-${idx++}`,
        philosopher,
        // 原著没有小标题，用首句做定位标签，检索结果里能看出讲的是什么
        section: text.slice(0, 48).replace(/\s+$/, "") + (text.length > 48 ? "…" : ""),
        text,
        tags: [],
        meta,
      });
    }
    buf = "";
  };

  for (const p of paras) {
    if (buf && buf.length + p.length > target) {
      const prev = buf;
      push();
      if (overlap > 0) {
        // 重叠段要对齐到词边界，否则德文会被切出半个词喂给模型
        let tail = prev.slice(-overlap);
        const space = tail.indexOf(" ");
        if (space > 0) tail = tail.slice(space + 1);
        buf = tail + " ";
      } else {
        buf = "";
      }
    }
    buf += (buf ? " " : "") + p;
  }
  push();

  return out;
}
