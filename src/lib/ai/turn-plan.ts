import { z } from "zod";

export const TurnPlanSchema = z.object({
  kind: z.enum(["observe", "respond", "question", "silence"]),
  observation: z.string().max(1200).nullable(),
  question: z.string().max(600).nullable(),
  pause: z.enum(["none", "short", "long"]),
  sourceRefs: z.array(z.string().max(40)).max(4),
  spatialCue: z.enum(["none", "paper", "object", "light"]),
});

export type TurnPlan = z.infer<typeof TurnPlanSchema>;

/**
 * Tool schema deliberately exposes only scene vocabulary.
 * The model cannot choose components, CSS, URLs, tools or safety states.
 */
export const TURN_PLAN_TOOL = {
  name: "compose_turn",
  description: "Compose one short, grounded turn for the philosopher at the table.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "observation", "question", "pause", "sourceRefs", "spatialCue"],
    properties: {
      kind: { type: "string", enum: ["observe", "respond", "question", "silence"] },
      observation: { type: ["string", "null"], description: "A short concrete observation, never a diagnosis or advice." },
      question: { type: ["string", "null"], description: "One optional open question, never a why-question or instruction." },
      pause: { type: "string", enum: ["none", "short", "long"] },
      sourceRefs: { type: "array", items: { type: "string" }, maxItems: 4, description: "Only source numbers from the supplied context, as strings." },
      spatialCue: { type: "string", enum: ["none", "paper", "object", "light"] },
    },
  },
} satisfies {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    additionalProperties: boolean;
    required: string[];
    properties: Record<string, unknown>;
  };
};

const FALLBACK_TURN: TurnPlan = {
  kind: "observe",
  observation: "我先不急着替它命名。让它在桌上待一会儿。",
  question: "现在最先被你注意到的，是它的颜色，还是它的边缘？",
  pause: "short",
  sourceRefs: [],
  spatialCue: "object",
};

export function normalizeTurnPlan(input: unknown, sourceCount: number): TurnPlan {
  const result = TurnPlanSchema.safeParse(input);
  if (!result.success) return FALLBACK_TURN;

  return {
    ...result.data,
    sourceRefs: result.data.sourceRefs.filter((ref) => {
      const index = Number(ref);
      return Number.isInteger(index) && index > 0 && index <= sourceCount;
    }),
  };
}

export function renderTurnPlan(plan: TurnPlan): string {
  const parts = [plan.observation, plan.question].filter((part): part is string => Boolean(part?.trim()));
  if (parts.length) return parts.join("\n\n");
  if (plan.kind === "silence") return "（他没有急着回答。桌面保持安静。）";
  return FALLBACK_TURN.observation ?? "";
}

/** Local preview mode keeps the scene explorable without pretending a model is present. */
export function mockTurn(lastUserMessage: string): TurnPlan {
  if (/沉默|不说|安静|不用回答/.test(lastUserMessage)) {
    return {
      kind: "silence",
      observation: null,
      question: null,
      pause: "long",
      sourceRefs: [],
      spatialCue: "light",
    };
  }

  return {
    ...FALLBACK_TURN,
    spatialCue: lastUserMessage.trim() ? "object" : "paper",
  };
}
