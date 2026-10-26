/**
 * 给原著分块打上真实的章节定位，如「VI. Untersuchung §39」。
 *
 * 为什么需要：archive.org 的 OCR 文本没有可靠的标题行，之前每块只能用首句
 * 快照当定位，前端出处没法核对，检索评测也没法按章节判定命中。
 * 但正文里的「§ N.」编号是连续的——沿着分块顺序追踪编号，就能把每一块
 * 归到它所在的 §。
 *
 * 每卷有哪些单元、各多少 § 写在 data/sources.json 的 structure 字段里，
 * 不在代码里硬编码。OCR 偶尔漏掉一个编号，追踪器容忍跳过 ≤ 2；
 * 正文里的回指（„vgl. § 12"）因为不等于下一个期望编号，基本不会被误认。
 */

export type Unit = { name: string; sections: number };
export type Structure = {
  /** 正文从第几块开始（之前是扉页与目录）。不填则自动探测。 */
  bodyStart?: number;
  units: Unit[];
};
export type SectionLabel = { unit: string; section: number };

/**
 * OCR 里 § 偶尔被认成 £，数字 1 偶尔被认成小写 l；
 * 编号后可能是 . 或 ,，中间可能有空格。
 */
const SECTION_MARK = /[§£]\s*([\dl]{1,3})\s*[.,]/g;

export function sectionNumbers(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  SECTION_MARK.lastIndex = 0;
  while ((m = SECTION_MARK.exec(text)) !== null) {
    const n = Number(m[1].replace(/l/g, "1"));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/**
 * 目录页的特征是一块里挤着很多 § 编号，正文一块最多两三个。
 * 正文起点 = 前 15% 分块里最后一个「密集块」的下一块。
 */
export function detectBodyStart(texts: string[], dense = 5): number {
  const scan = Math.max(10, Math.floor(texts.length * 0.15));
  let last = -1;
  for (let i = 0; i < Math.min(scan, texts.length); i++) {
    if (sectionNumbers(texts[i]).length >= dense) last = i;
  }
  return last + 1;
}

/**
 * 返回每一块的定位；正文之前（扉页、目录）为 null。
 * 一块里没出现新编号时，沿用上一块的定位——分块是带重叠的滑动窗口，
 * 「还在同一节里」是正确的默认。
 */
export function locateSections(
  texts: string[],
  structure: Structure,
): (SectionLabel | null)[] {
  const start = structure.bodyStart ?? detectBodyStart(texts);
  const units = structure.units;
  const labels: (SectionLabel | null)[] = new Array(texts.length).fill(null);

  let ui = -1; // 当前单元下标；-1 = 还没进入正文
  let expect = 1; // 下一个期望的 § 编号
  let current: SectionLabel | null = null;

  const hasSoon = (from: number, n: number) =>
    texts.slice(from, from + 14).some((t) => sectionNumbers(t).includes(n));

  for (let i = start; i < texts.length; i++) {
    for (const n of sectionNumbers(texts[i])) {
      const unit = units[ui];
      const exhausted = ui >= 0 && expect > unit.sections;
      const nextUnit = units[ui + 1];

      // 进入正文 / 进入下一单元：看到 § 1（或 OCR 丢了 § 1 时的 § 2、§ 3），
      // 且后面很快出现下一个编号——排除正文里孤立的回指。
      if (nextUnit && (ui === -1 || exhausted) && n <= 3 && hasSoon(i, n + 1)) {
        ui += 1;
        expect = n + 1;
        current = { unit: nextUnit.name, section: n };
        continue;
      }
      if (ui === -1) continue;

      // 顺序推进；容忍 OCR 漏掉最多两个编号
      if (n >= expect && n <= expect + 2 && n <= unit.sections) {
        expect = n + 1;
        current = { unit: unit.name, section: n };
      }
    }
    labels[i] = current;
  }
  return labels;
}

export function formatLabel(l: SectionLabel): string {
  return `${l.unit} §${l.section}`;
}

/** 解析 formatLabel 的输出；不是定位标签则返回 null */
export function parseLabel(section: string): SectionLabel | null {
  const m = section.match(/^(.+?) §(\d+)$/);
  return m ? { unit: m[1], section: Number(m[2]) } : null;
}

/**
 * archive.org / Google Books 扫描本前面几页是英德双语的使用说明，
 * 与原著无关，却会被检索到（尤其英文提问时）。索引前剔除。
 */
export function isScanBoilerplate(text: string): boolean {
  return /Google Book Search|digital copy of a book|Nutzungsrichtlinien|Über Google Buchsuche|public domain book|automated querying/i.test(
    text,
  );
}
