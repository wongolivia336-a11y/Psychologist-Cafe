import { readFile } from "node:fs/promises";
import path from "node:path";
import { PERSONAS, SHARED_FRAME } from "../src/lib/personas";
import { detectCrisis, findBanned } from "../src/lib/safety";
import { retrieve } from "../src/lib/rag/retrieve";

type Check = { name: string; ok: boolean; detail?: string };

const root = process.cwd();
const readJson = async <T>(relative: string): Promise<T> =>
  JSON.parse(await readFile(path.join(root, relative), "utf8")) as T;

const check = (checks: Check[], name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  ${detail}` : ""}`);
};

async function main() {
  const checks: Check[] = [];
  const personaCases = await readJson<{ personaId: string; mustAvoid: string[] }[]>("eval/personas/cases.json");
  const groundingCases = await readJson<{
    id: string;
    query: string;
    philosophers: string[];
    minHits: number;
    expectedTerms?: string[];
  }[]>("eval/grounding/cases.json");
  const safetyCases = await readJson<{
    id: string;
    kind: "crisis" | "output";
    text: string;
    expected: string;
  }[]>("eval/safety/cases.json");
  const experience = await readJson<{ viewports: { width: number; height: number }[]; states: unknown[] }>("eval/experience/checklist.json");

  console.log("── personas contract ──");
  check(checks, "胡塞尔桌存在且有人格提示", Boolean(PERSONAS.find((p) => p.id === "husserl")?.system));
  check(checks, "共享框架包含不诊断边界", SHARED_FRAME.includes("不做诊断"));
  for (const item of personaCases) {
    const persona = PERSONAS.find((p) => p.id === item.personaId);
    check(checks, `${item.personaId}/${item.mustAvoid.join("、")} 由共享框架覆盖`, Boolean(persona && item.mustAvoid.some((term) => SHARED_FRAME.includes(term) || persona.system.includes(term))));
  }

  console.log("\n── grounding retrieval ──");
  for (const item of groundingCases) {
    const hits = await retrieve(item.query, { philosophers: item.philosophers, topK: 5 });
    const text = hits.map((hit) => hit.text).join(" ");
    const termsOk = !item.expectedTerms?.length || item.expectedTerms.some((term) => text.includes(term));
    check(checks, item.id, hits.length >= item.minHits && termsOk, `${hits.length} 条召回`);
  }

  console.log("\n── safety deterministic cases ──");
  for (const item of safetyCases) {
    if (item.kind === "crisis") {
      const actual = detectCrisis(item.text).level;
      check(checks, item.id, actual === item.expected, `${actual} / expected ${item.expected}`);
    } else {
      const actual = findBanned(item.text).length ? "blocked" : "allowed";
      check(checks, item.id, actual === item.expected, `${actual} / expected ${item.expected}`);
    }
  }

  console.log("\n── experience fixture ──");
  check(checks, "四个截图视口已登记", experience.viewports.length === 4);
  check(checks, "关键场景清单已登记", experience.states.length >= 6);

  const failures = checks.filter((item) => !item.ok);
  console.log(`\n通过 ${checks.length - failures.length}，失败 ${failures.length}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
