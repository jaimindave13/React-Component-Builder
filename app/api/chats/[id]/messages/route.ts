import { addMessage } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: { id?: string; role?: string; content?: string };
  try {
    body = (await req.json()) as { id?: string; role?: string; content?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.role !== "user" && body.role !== "assistant") {
    return Response.json({ error: "role must be user or assistant" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const message = addMessage(id, {
      id: body.id?.trim() || crypto.randomUUID(),
      role: body.role,
      content: body.content,
    });

    if (!message) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    return Response.json({ message }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save message" },
      { status: 500 },
    );
  }
}
