import { deleteChat, getChat, updateChat } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const chat = getChat(id);
    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }
    return Response.json({ chat });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load chat" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: { title?: string; agentId?: string | null; latestCode?: string | null };
  try {
    body = (await req.json()) as {
      title?: string;
      agentId?: string | null;
      latestCode?: string | null;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const chat = updateChat(id, body);
    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }
    return Response.json({ chat });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to update chat" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const deleted = deleteChat(id);
    if (!deleted) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to delete chat" },
      { status: 500 },
    );
  }
}
