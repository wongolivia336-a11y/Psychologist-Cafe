import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/claude";
import { getPersona } from "@/lib/personas";
import { retrieve } from "@/lib/rag/retrieve";
import { buildSystem, type DishContext, type MemoryContext } from "@/lib/prompt";
import { StreamingFilter, crisisMessage, detectCrisis, SOFT_NOTE } from "@/lib/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  personaId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  dish?: DishContext;
  memory?: MemoryContext;
};

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

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
              section: s.section,
              author: s.meta.author,
              title: s.meta.title,
              year: s.meta.year,
              license: s.meta.license,
              sourcePage: s.meta.sourcePage,
              score: Number(s.score.toFixed(4)),
              via: s.via,
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

        // 3. 调模型
        const msg = anthropic().messages.stream({
          model: MODEL,
          max_tokens: 700,
          temperature: 1,
          system: blocks.map((b) => ({
            type: "text" as const,
            text: b.text,
            ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
          })),
          messages: body.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of msg) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const safe = filter.push(event.delta.text);
            if (safe) controller.enqueue(sse("text", { text: safe }));
          }
        }

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
