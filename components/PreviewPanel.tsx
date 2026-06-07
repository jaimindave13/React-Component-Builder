"use client";

import { useState } from "react";
import { Eye, Code2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import LivePreview from "@/components/LivePreview";
import CodeView from "@/components/CodeView";
import ThemeToggle from "@/components/ThemeToggle";

type Tab = "preview" | "code";

export default function PreviewPanel({
  code,
  isStreaming,
}: {
  code: string;
  isStreaming: boolean;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-slate-100/60 dark:bg-slate-900/40">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="inline-flex rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800/60">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
            <Eye className="h-4 w-4" />
            Preview
          </TabButton>
          <TabButton active={tab === "code"} onClick={() => setTab("code")}>
            <Code2 className="h-4 w-4" />
            Code
          </TabButton>
        </div>

        <div className="flex items-center gap-3">
          {isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 dark:bg-indigo-400" />
              Generating
            </span>
          )}
          {tab === "preview" && code && (
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Reload preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {tab === "preview" ? (
          <div key={reloadKey} className="h-full w-full">
            <LivePreview code={code} isStreaming={isStreaming} />
          </div>
        ) : (
          <CodeView code={code} />
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}
