import { describe, expect, it } from "vitest";
import {
  detectBodyStart,
  formatLabel,
  isScanBoilerplate,
  locateSections,
  parseLabel,
  sectionNumbers,
} from "./sections";

describe("sectionNumbers", () => {
  it("认得 OCR 的各种写法", () => {
    expect(sectionNumbers("§ 12. Text § 13, mehr §14. £ 15. § l. § 2l.")).toEqual([
      12, 13, 14, 15, 1, 21,
    ]);
  });
  it("不把页码或年份当编号", () => {
    expect(sectionNumbers("S. 143 (1901) vgl. oben")).toEqual([]);
  });
});

describe("detectBodyStart", () => {
  it("目录是编号密集块，正文从其后开始", () => {
    const texts = [
      "Vorwort",
      "§ 1. A § 2. B § 3. C § 4. D § 5. E § 6. F", // 目录
      "§ 7. G § 8. H § 9. I § 10. J § 11. K", // 目录
      "§ 1. Der Anfang…",
      "…Fortsetzung",
    ];
    expect(detectBodyStart(texts)).toBe(3);
  });
});

describe("locateSections", () => {
  const structure = {
    bodyStart: 0,
    units: [
      { name: "Einleitung", sections: 2 },
      { name: "I. Untersuchung", sections: 4 },
      { name: "II. Untersuchung", sections: 3 },
    ],
  };

  it("顺着编号推进，没有新编号的块沿用上一块", () => {
    const texts = ["§ 1. a", "noch a", "§ 2. b", "§ 1. c", "§ 2. d", "§ 3. e", "§ 4. f"];
    const labels = locateSections(texts, structure).map((l) => (l ? formatLabel(l) : null));
    expect(labels).toEqual([
      "Einleitung §1",
      "Einleitung §1",
      "Einleitung §2",
      "I. Untersuchung §1",
      "I. Untersuchung §2",
      "I. Untersuchung §3",
      "I. Untersuchung §4",
    ]);
  });

  it("容忍 OCR 漏掉一个编号", () => {
    const texts = ["§ 1. a", "§ 2. b", "§ 1. c", "§ 3. e", "§ 4. f"];
    const labels = locateSections(texts, structure).map((l) => l && formatLabel(l));
    expect(labels[3]).toBe("I. Untersuchung §3");
  });

  it("单元的 § 1 被 OCR 吞掉时，从 § 2 起也能开新单元", () => {
    const texts = ["§ 1. a", "§ 2. b", "§ l. c", "§ 2. d", "§ 3. e", "§ 4. f", "§ 2. g", "§ 3. h"];
    const labels = locateSections(texts, structure).map((l) => l && formatLabel(l));
    expect(labels[6]).toBe("II. Untersuchung §2");
    expect(labels[7]).toBe("II. Untersuchung §3");
  });

  it("正文里孤立的回指不会开新单元", () => {
    const texts = ["§ 1. a", "§ 2. b", "§ 1. c", "wie in § 1 gesagt", "§ 2. d", "§ 3. e", "§ 4. f"];
    const labels = locateSections(texts, structure).map((l) => l && formatLabel(l));
    // 第 3 块的「§ 1」是回指：I. Untersuchung 尚未用完，不允许开新单元
    expect(labels[3]).toBe("I. Untersuchung §1");
    expect(labels[4]).toBe("I. Untersuchung §2");
  });

  it("正文之前的块为 null", () => {
    const texts = ["Titel", "Inhalt", "§ 1. a", "§ 2. b"];
    const labels = locateSections(texts, { ...structure, bodyStart: 2 });
    expect(labels[0]).toBeNull();
    expect(labels[1]).toBeNull();
  });
});

describe("parseLabel / formatLabel", () => {
  it("往返一致", () => {
    const l = { unit: "VI. Untersuchung", section: 39 };
    expect(parseLabel(formatLabel(l))).toEqual(l);
  });
  it("首句快照不是定位标签", () => {
    expect(parseLabel("sehr wol; aber sie sind widersinnig…")).toBeNull();
  });
});

describe("isScanBoilerplate", () => {
  it("识别 Google Books 说明页", () => {
    expect(isScanBoilerplate("This is a digital copy of a book that was preserved…")).toBe(true);
    expect(isScanBoilerplate("Über Google Buchsuche")).toBe(true);
  });
  it("原著正文不受影响", () => {
    expect(isScanBoilerplate("Die Logik als normative Disciplin")).toBe(false);
  });
});
