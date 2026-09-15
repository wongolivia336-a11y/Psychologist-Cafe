import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runEval } from "../../../scripts/eval-retrieve";

/**
 * 检索质量回归线。数字来自 scripts/eval-retrieve.ts（见 README「检索质量」），
 * 门槛故意比实测低几个点：目的是拦住「改了分词/扩展表之后检索悄悄变差」，
 * 不是让每次微调都得重新调门槛。
 *
 * 需要 data/index.json（npm run index）。没有索引时跳过而不是失败，
 * 因为单元测试不应该依赖 20 秒的构建产物；CI 里会先建索引。
 */
const INDEX = path.resolve(import.meta.dirname, "../../../data/index.json");
const GOLD = path.resolve(import.meta.dirname, "../../../eval/husserl-gold.json");

describe.skipIf(!existsSync(INDEX))("检索质量回归（husserl-gold）", () => {
  it("线上配置 bm25+expand 不低于回归线", async () => {
    const { results } = await runEval(GOLD);
    const prod = results.find((r) => r.name === "bm25+expand")!;
    expect(prod.ran).toBe(true);
    expect(prod.hit5).toBeGreaterThanOrEqual(0.65);
    expect(prod.mrr).toBeGreaterThanOrEqual(0.4);
  });

  it("扩展确实在起作用：关掉它应显著变差", async () => {
    const { results } = await runEval(GOLD);
    const raw = results.find((r) => r.name === "bm25")!;
    const prod = results.find((r) => r.name === "bm25+expand")!;
    expect(prod.hit5 - raw.hit5).toBeGreaterThan(0.3);
  });

  it("命中率明显高于随机基线", async () => {
    const { results } = await runEval(GOLD);
    const prod = results.find((r) => r.name === "bm25+expand")!;
    expect(prod.hit5).toBeGreaterThan(prod.randomHit5 * 3);
  });
});
