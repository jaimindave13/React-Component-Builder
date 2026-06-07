"use client";

import { MessageSquarePlus, Trash2, History } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: number;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ChatHistory({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
}: {
  chats: ChatListItem[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-slate-200 bg-slate-100/80 dark:border-white/10 dark:bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 dark:border-white/10">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <History className="h-3.5 w-3.5" />
          History
        </span>
        <button
          onClick={onNew}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="New chat"
          title="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {chats.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Saved chats will appear here
          </p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => {
              const active = chat.id === activeChatId;
              return (
                <li key={chat.id} className="group relative">
                  <button
                    onClick={() => onSelect(chat.id)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 pr-8 text-left transition",
                      active
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100"
                        : "text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white",
                    )}
                  >
                    <span className="block truncate text-xs font-medium">{chat.title}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(chat.updatedAt)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chat.id);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-500/20 dark:hover:text-red-300"
                    aria-label={`Delete ${chat.title}`}
                    title="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
