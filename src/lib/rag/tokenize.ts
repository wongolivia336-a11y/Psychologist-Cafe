/**
 * 中英德混合分词。
 * 中文没有空格，用「二元组（bigram）」切；拉丁文字按词切并小写。
 * 这个组合对本项目的语料（中文卡片 + 德文原著）都够用，且零依赖。
 */

const CJK = /[一-鿿㐀-䶿]/;
/** 拉丁词（含德文变音、法文重音） */
const LATIN_WORD = /[a-zA-ZÀ-ɏ]+/g;
const DIGITS = /\d+/g;

/** 中英文停用词。德文停用词也放进来，否则 der/die/und 会淹没 BM25。 */
const STOP = new Set([
  // zh
  "的", "了", "和", "是", "在", "有", "个", "我", "你", "他", "她", "它", "这", "那",
  "就", "都", "而", "及", "与", "或", "一个", "不是", "什么", "可以", "没有", "自己",
  // en
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "it", "that", "this", "as",
  "for", "on", "with", "be", "are", "was", "were", "by", "at", "from", "but", "not",
  // de
  "der", "die", "das", "den", "dem", "des", "und", "oder", "ein", "eine", "einen",
  "einem", "eines", "ist", "sind", "war", "waren", "nicht", "auch", "auf", "aus",
  "sich", "als", "wir", "sie", "er", "es", "im", "in", "zu", "zum", "zur", "von",
  "mit", "dass", "daß", "aber", "wenn", "so", "nur", "man", "wird", "werden", "haben",
  "hat", "sein", "seine", "einer", "diese", "dieser", "dieses", "durch", "über",
]);

export function tokenize(input: string): string[] {
  const out: string[] = [];
  const text = input.toLowerCase();

  // 拉丁词
  for (const m of text.matchAll(LATIN_WORD)) {
    const w = m[0];
    if (w.length < 2 || STOP.has(w)) continue;
    out.push(w);
  }

  // 数字（§ 编号、年份等）
  for (const m of text.matchAll(DIGITS)) {
    if (m[0].length <= 4) out.push(m[0]);
  }

  // 中文：连续汉字段 -> 单字 + 二元组
  let run = "";
  const flush = () => {
    if (!run) return;
    if (run.length === 1) {
      if (!STOP.has(run)) out.push(run);
    } else {
      for (let i = 0; i < run.length; i++) {
        const uni = run[i];
        if (!STOP.has(uni)) out.push(uni);
        if (i < run.length - 1) {
          const bi = run.slice(i, i + 2);
          if (!STOP.has(bi)) out.push(bi);
        }
      }
    }
    run = "";
  };
  for (const ch of text) {
    if (CJK.test(ch)) run += ch;
    else flush();
  }
  flush();

  return out;
}

export function termFreq(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}
