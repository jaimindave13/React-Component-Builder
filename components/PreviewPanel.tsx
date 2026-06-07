"use client";

import { useState } from "react";
import { Eye, Code2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import LivePreview from "@/components/LivePreview";
import CodeView from "@/components/CodeView";

type Tab = "preview" | "code";

export default function PreviewPanel({
  code,
  isStreaming,
}: {
  code: string;
  isStreaming: boolean;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  // Forces the iframe to remount when the user clicks refresh.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-slate-900/40">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="inline-flex rounded-xl bg-slate-800/60 p-1">
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
            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              Generating
            </span>
          )}
          {tab === "preview" && code && (
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
              aria-label="Reload preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {tab === "preview" ? (
          <div key={reloadKey} className="h-full w-full">
            <LivePreview code={code} />
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
          ? "bg-slate-700 text-white shadow"
          : "text-slate-400 hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}
