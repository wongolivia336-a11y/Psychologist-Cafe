import assert from "node:assert/strict";
import { mockTurn, normalizeTurnPlan, renderTurnPlan } from "../src/lib/ai/turn-plan";

const plan = normalizeTurnPlan(
  {
    kind: "question",
    observation: "桌面上的线条没有急着闭合。",
    question: "你先看见了哪一段？",
    pause: "short",
    sourceRefs: ["1", "99", "bad"],
    spatialCue: "paper",
  },
  1,
);

assert.deepEqual(plan.sourceRefs, ["1"]);
assert.match(renderTurnPlan(plan), /桌面上的线条/);

const silence = mockTurn("先不用回答，安静一会儿");
assert.equal(silence.kind, "silence");
assert.equal(silence.pause, "long");
assert.match(renderTurnPlan(silence), /安静/);

console.log("TurnPlan smoke test passed");
