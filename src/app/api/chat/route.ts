import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/claude";
import { getPersona } from "@/lib/personas";
import { retrieve } from "@/lib/rag/retrieve";
import { buildSystem } from "@/lib/prompt";
import { StreamingFilter, crisisMessage, detectCrisis, SOFT_NOTE } from "@/lib/safety";
import { TURN_PLAN_TOOL, mockTurn, normalizeTurnPlan, renderTurnPlan, type TurnPlan } from "@/lib/ai/turn-plan";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// SSE 流式对话会超过 Vercel 的默认函数时限，必须显式放宽
export const maxDuration = 60;

const ChatBodySchema = z.object({
  personaId: z.string().min(1).max(80),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(12_000),
    }),
  ).min(1).max(40),
  dish: z.object({
    items: z.array(z.string().max(120)).max(12),
    colors: z.array(z.string().max(40)).max(12),
    temperature: z.string().max(20).optional(),
    note: z.string().max(500).optional(),
  }).nullable().optional(),
  memory: z.object({
    object: z.string().max(120),
    label: z.string().max(500),
  }).nullable().optional(),
});

type Body = z.infer<typeof ChatBodySchema>;

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = ChatBodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "请求内容不符合这张桌子的格式" }, { status: 400 });
  }
  const body: Body = parsed.data;

  const persona = getPersona(body.personaId);
  if (!persona) {
    return Response.json({ error: `未知角色：${body.personaId}` }, { status: 404 });
  }
  if (!persona.unlocked) {
    return Response.json({ error: "这张桌子还坐不过去。" }, { status: 403 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages 不能为空" }, { status: 400 });
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const crisis = detectCrisis(lastUser?.content ?? "");

  // ── 危机路径：不调模型，直接出戏 ──
  if (crisis.level === "hard") {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sse("crisis", { matched: crisis.matched }));
        for (const line of crisisMessage().split("\n")) {
          controller.enqueue(sse("text", { text: line + "\n" }));
        }
        controller.enqueue(sse("done", { crisis: true }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  // ── 正常路径 ──
  const stream = new ReadableStream({
    async start(controller) {
      const filter = new StreamingFilter();
      try {
        // 1. 检索：用最近两轮用户发言做查询，比只用最后一句更稳
        const query = body.messages
          .filter((m) => m.role === "user")
          .slice(-2)
          .map((m) => m.content)
          .join(" ");

        const sources = await retrieve(query, {
          philosophers: persona.corpus,
          topK: 5,
        });

        controller.enqueue(
          sse(
            "sources",
            sources.map((s) => ({
              id: s.id,
              section: s.section,
              author: s.meta.author,
              title: s.meta.title,
              license: s.meta.license,
              sourcePage: s.meta.sourcePage,
            })),
          ),
        );

        // 2. 组装 system
        const blocks = buildSystem(
          persona,
          sources,
          body.dish ?? null,
          body.memory ?? null,
          crisis.level === "soft" ? SOFT_NOTE : undefined,
        );

        // 3. 先生成结构化 TurnPlan，再把它渲染成场景事件与谈话片段。
        // 没有 key 时使用本地 mock，预览仍然可以走完完整交互路径。
        let plan: TurnPlan;
        if (!process.env.ANTHROPIC_API_KEY) {
          plan = mockTurn(lastUser?.content ?? "");
        } else {
          const msg = await anthropic().messages.create({
            model: MODEL,
            max_tokens: 500,
            temperature: 1,
            system: blocks.map((b) => ({
              type: "text" as const,
              text: `${b.text}\n\n## 输出协议\n不要直接输出文字。请调用 compose_turn 工具。sourceRefs 只能使用检索段落的序号字符串。一次只生成一个观察或一个问题，不要给建议，不要总结。`,
              ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
            })),
            tools: [TURN_PLAN_TOOL],
            tool_choice: { type: "tool", name: "compose_turn" },
            messages: body.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          });
          const toolBlock = msg.content.find((block) => block.type === "tool_use");
          plan = normalizeTurnPlan(toolBlock?.type === "tool_use" ? toolBlock.input : null, sources.length);
        }

        controller.enqueue(sse("turn_plan", plan));
        controller.enqueue(sse("scene", {
          kind: plan.kind,
          pause: plan.pause,
          spatialCue: plan.spatialCue,
        }));

        const text = renderTurnPlan(plan);
        const safe = filter.push(text);
        if (safe) controller.enqueue(sse("text", { text: safe }));

        const tail = filter.flush();
        if (tail) controller.enqueue(sse("text", { text: tail }));

        if (filter.violations.length) {
          controller.enqueue(sse("filtered", { violations: filter.violations }));
        }
        controller.enqueue(sse("done", {}));
      } catch (err) {
        console.error("[/api/chat]", err);
        controller.enqueue(
          sse("error", { message: (err as Error).message ?? "未知错误" }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
