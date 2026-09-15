import { describe, expect, it } from "vitest";
import { expandQuery } from "./expand";

describe("expandQuery", () => {
  it("中文提问对德文语料：追加德文术语，原查询保留", () => {
    const out = expandQuery("什么叫奠基", ["de"]);
    expect(out.startsWith("什么叫奠基")).toBe(true);
    expect(out).toContain("Fundirung");
  });

  it("目标语言里没有中文时，不追加中文", () => {
    const out = expandQuery("Evidenz", ["de"]);
    expect(out).toBe("Evidenz");
  });

  it("德文提问对中文卡片：反向扩展", () => {
    expect(expandQuery("Wahrnehmung", ["zh"])).toContain("知觉");
  });

  it("同一术语不重复追加", () => {
    // 「整体」和「部分」都映射到 Ganze 系，但只应出现一次
    const out = expandQuery("整体和部分 整体", ["de"]);
    const n = out.split(/\s+/).filter((t) => t === "Ganze").length;
    expect(n).toBe(1);
  });

  it("没有命中任何概念时原样返回", () => {
    expect(expandQuery("今天天气不错", ["de"])).toBe("今天天气不错");
  });
});
