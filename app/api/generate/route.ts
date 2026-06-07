import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";

// The Cursor SDK spawns a local executor (child processes, fs access), so this
// route must run on the Node.js runtime and never be statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL_ID = process.env.CURSOR_MODEL_ID ?? "composer-2.5";
const MODEL = { id: MODEL_ID };

const SYSTEM_PROMPT = `You are an expert React + Tailwind CSS UI engineer powering a component builder.

When the user describes a component or UI, respond with ONE self-contained React component.

Strict output rules:
- Reply with a SINGLE fenced code block tagged \`tsx\` and nothing else before or after it (no prose, no explanation).
- Define a function component named exactly \`App\` as the root, e.g. \`function App() { ... }\`.
- Do NOT write any import statements. React and its hooks are available as globals: use \`React.useState\`, \`React.useEffect\`, etc.
- Style everything with Tailwind CSS utility classes only. Do not use external UI libraries.
- Make it polished, responsive, accessible, and visually attractive with realistic placeholder content.
- Keep it to a single file with no markdown, comments-only output, or multiple components exported.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GenerateRequest {
  messages?: ChatMessage[];
  prompt?: string;
  agentId?: string;
}

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function joinAssistantText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "CURSOR_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const prompt =
    body.prompt?.trim() ||
    [...(body.messages ?? [])].reverse().find((m) => m.role === "user")?.content?.trim();

  if (!prompt) {
    return Response.json({ error: "No prompt provided" }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let agent: SDKAgent | undefined;
      let closed = false;
      const send = (data: unknown) => {
        if (!closed) controller.enqueue(sse(data));
      };

      try {
        if (body.agentId) {
          // Resume keeps the full conversation context for follow-up edits.
          agent = await Agent.resume(body.agentId, {
            apiKey,
            model: MODEL,
            local: { cwd: process.cwd() },
          });
        } else {
          agent = await Agent.create({
            apiKey,
            model: MODEL,
            // Set the runtime explicitly to avoid a silent local/cloud mixup.
            local: { cwd: process.cwd() },
          });
        }

        send({ type: "agent", agentId: agent.agentId });

        const message = body.agentId ? prompt : `${SYSTEM_PROMPT}\n\nUser request:\n${prompt}`;
        // Local agents require an explicit model on every send, not just create.
        const run = await agent.send(message, { model: MODEL });

        send({ type: "run", runId: run.id });

        let lastSnapshot = "";
        for await (const event of run.stream()) {
          if (event.type === "assistant") {
            const text = joinAssistantText(event.message.content);
            // Local runtime emits growing snapshots; forward the full text and
            // let the client replace its in-progress assistant message.
            if (text && text !== lastSnapshot) {
              lastSnapshot = text;
              send({ type: "delta", text });
            }
          }
        }

        const result = await run.wait();
        if (result.status === "error") {
          send({ type: "error", error: "The model run failed. Please try again." });
        } else if (result.status === "cancelled") {
          send({ type: "error", error: "The run was cancelled." });
        } else {
          const finalText = result.result ?? lastSnapshot;
          send({ type: "done", text: finalText, agentId: agent.agentId });
        }
      } catch (err) {
        if (err instanceof CursorAgentError) {
          send({
            type: "error",
            error: `Could not start the agent: ${err.message}`,
            retryable: err.isRetryable,
          });
        } else {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Unexpected server error",
          });
        }
      } finally {
        try {
          await agent?.[Symbol.asyncDispose]?.();
        } catch {
          // ignore disposal errors
        }
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
