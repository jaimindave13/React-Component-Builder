"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Code2 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function CodeView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; silently ignore.
    }
  }

  if (!code) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
        <Code2 className="h-6 w-6 opacity-60" />
        <p className="text-sm">Generated code will appear here.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg backdrop-blur transition hover:bg-slate-50 active:scale-95 dark:border-white/10 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700"
        aria-label="Copy code"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>

      <div className="h-full w-full overflow-auto">
        <SyntaxHighlighter
          language="tsx"
          style={isDark ? oneDark : oneLight}
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            minHeight: "100%",
            background: isDark ? "#0b1120" : "#f8fafc",
            fontSize: "13px",
            padding: "1.25rem",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), ui-monospace, monospace" } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
