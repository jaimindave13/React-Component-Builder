import { createChat, listChats, chatTitleFromPrompt } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const chats = listChats();
    return Response.json({ chats });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load chats" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: { id?: string; title?: string };
  try {
    body = (await req.json()) as { id?: string; title?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body.id?.trim() || crypto.randomUUID();
  const title = body.title?.trim() ? chatTitleFromPrompt(body.title) : "New chat";

  try {
    const chat = createChat(id, title);
    return Response.json({ chat }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create chat" },
      { status: 500 },
    );
  }
}
