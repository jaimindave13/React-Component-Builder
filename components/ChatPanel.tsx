"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, User, Bot, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import { extractCode } from "@/lib/extract-code";
import ChatHistory, { type ChatListItem } from "@/components/ChatHistory";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const EXAMPLES = [
  "A pricing page with three tiers and a popular badge",
  "A modern login form with social buttons",
  "An animated stats dashboard card grid",
];

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export default function ChatPanel({
  onCode,
  onStreamingChange,
}: {
  onCode: (code: string) => void;
  onStreamingChange: (streaming: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const agentIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshChats = useCallback(async () => {
    const data = await apiJson<{ chats: ChatListItem[] }>("/api/chats");
    setChats(
      data.chats.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
      })),
    );
  }, []);

  useEffect(() => {
    refreshChats().catch(() => {
      // History is optional; the chat still works if the DB is unavailable.
    });
  }, [refreshChats]);

  useEffect(() => {
    onStreamingChange(isStreaming);
  }, [isStreaming, onStreamingChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ensureChat(prompt: string): Promise<string> {
    if (activeChatId) return activeChatId;

    const id = crypto.randomUUID();
    const data = await apiJson<{ chat: { id: string; title: string; updatedAt: number } }>(
      "/api/chats",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: prompt }),
      },
    );

    setActiveChatId(data.chat.id);
    setChats((prev) => [
      { id: data.chat.id, title: data.chat.title, updatedAt: data.chat.updatedAt },
      ...prev,
    ]);
    return data.chat.id;
  }

  async function saveMessage(
    chatId: string,
    message: { id: string; role: "user" | "assistant"; content: string },
  ) {
    await apiJson(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    await refreshChats();
  }

  async function updateChatMeta(
    chatId: string,
    patch: { agentId?: string; latestCode?: string },
  ) {
    await apiJson(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await refreshChats();
  }

  function startNewChat() {
    if (isStreaming) return;
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setError(null);
    agentIdRef.current = undefined;
    onCode("");
  }

  async function loadChat(chatId: string) {
    if (isStreaming || chatId === activeChatId) return;

    setLoadingChat(true);
    setError(null);

    try {
      const data = await apiJson<{
        chat: {
          id: string;
          agentId: string | null;
          latestCode: string | null;
          messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
        };
      }>(`/api/chats/${chatId}`);

      setActiveChatId(data.chat.id);
      setMessages(
        data.chat.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
      );
      agentIdRef.current = data.chat.agentId ?? undefined;
      onCode(data.chat.latestCode ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat");
    } finally {
      setLoadingChat(false);
    }
  }

  async function deleteChat(chatId: string) {
    if (isStreaming) return;

    try {
      await apiJson(`/api/chats/${chatId}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        startNewChat();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete chat");
    }
  }

  async function generate() {
    const prompt = input.trim();
    if (!prompt || isStreaming) return;

    setError(null);
    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: prompt };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    let chatId: string | undefined;
    let finalAssistantText = "";

    try {
      chatId = await ensureChat(prompt);
      await saveMessage(chatId, userMsg);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, agentId: agentIdRef.current }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const updateAssistant = (text: string) => {
        finalAssistantText = text;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m)),
        );
        const code = extractCode(text);
        if (code) onCode(code);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          switch (event.type) {
            case "agent":
              agentIdRef.current = event.agentId as string;
              break;
            case "delta":
            case "done":
              updateAssistant(event.text as string);
              break;
            case "error":
              throw new Error((event.error as string) || "Generation failed");
          }
        }
      }

      if (chatId && finalAssistantText) {
        const code = extractCode(finalAssistantText);
        await saveMessage(chatId, {
          id: assistantId,
          role: "assistant",
          content: finalAssistantText,
        });
        await updateChatMeta(chatId, {
          agentId: agentIdRef.current,
          latestCode: code ?? undefined,
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (chatId && finalAssistantText) {
          const code = extractCode(finalAssistantText);
          await saveMessage(chatId, {
            id: assistantId,
            role: "assistant",
            content: finalAssistantText,
          }).catch(() => {});
          await updateChatMeta(chatId, {
            agentId: agentIdRef.current,
            latestCode: code ?? undefined,
          }).catch(() => {});
        }
      } else {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        const errorContent = `Error: ${msg}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.content === "" ? { ...m, content: errorContent } : m,
          ),
        );
        if (chatId) {
          await saveMessage(chatId, {
            id: assistantId,
            role: "assistant",
            content: errorContent,
          }).catch(() => {});
        }
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      generate();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <section className="flex h-full w-full max-w-[620px] border-r border-white/10 bg-slate-950/60">
      <ChatHistory
        chats={chats}
        activeChatId={activeChatId}
        onSelect={loadChat}
        onNew={startNewChat}
        onDelete={deleteChat}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white">Component Builder</h1>
            <p className="text-xs text-slate-400">Describe it, generate it, preview it</p>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {loadingChat ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading chat...
            </div>
          ) : !hasMessages ? (
            <div className="space-y-4 pt-6">
              <p className="text-sm text-slate-400">
                Describe a React component and it will be generated with a live preview.
                Try one of these:
              </p>
              <div className="space-y-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-indigo-400/40 hover:bg-slate-800/60"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <ChatBubble key={m.id} message={m} isStreaming={isStreaming} />)
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-2 shadow-inner focus-within:border-indigo-400/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Describe the component you want to build..."
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-slate-500">⌘/Ctrl + Enter to generate</span>
              {isStreaming ? (
                <button
                  onClick={stop}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 active:scale-95"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={generate}
                  disabled={!input.trim() || loadingChat}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Generate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === "user";
  const showThinking = !isUser && message.content === "" && isStreaming;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-indigo-500/20 text-indigo-300" : "bg-fuchsia-500/20 text-fuchsia-300",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-indigo-500 text-white"
            : "border border-white/10 bg-slate-900/70 text-slate-200",
        )}
      >
        {showThinking ? (
          <span className="inline-flex items-center gap-2 text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating component...
          </span>
        ) : isUser ? (
          message.content
        ) : (
          <AssistantSummary content={message.content} />
        )}
      </div>
    </div>
  );
}

function AssistantSummary({ content }: { content: string }) {
  const code = extractCode(content);
  if (!code) {
    return <span>{content}</span>;
  }
  const lines = code.split("\n").length;
  return (
    <span className="inline-flex items-center gap-2 text-slate-300">
      <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
      Component ready — {lines} lines. See the preview on the right.
    </span>
  );
}
