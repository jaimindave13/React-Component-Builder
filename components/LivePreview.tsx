"use client";

import { useEffect, useMemo, useState } from "react";
import { Layout, Loader2 } from "lucide-react";
import { detectComponentName, prepareForPreview } from "@/lib/extract-code";

function buildSrcDoc(rawCode: string): string {
  const code = prepareForPreview(rawCode);
  const componentName = detectComponentName(code);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
      html, body { margin: 0; padding: 0; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
      #error-overlay {
        display: none;
        position: fixed;
        inset: 0;
        padding: 24px;
        background: #1a0d0d;
        color: #fca5a5;
        font-family: ui-monospace, monospace;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        overflow: auto;
        z-index: 9999;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <pre id="error-overlay"></pre>
    <script>
      function showError(message) {
        var el = document.getElementById("error-overlay");
        el.style.display = "block";
        el.textContent = "Preview error:\\n\\n" + message;
      }
      window.addEventListener("error", function (e) {
        showError((e.error && e.error.stack) || e.message || String(e));
      });
    </script>
    <script type="text/babel" data-presets="react,typescript" data-type="module">
      try {
        const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, Fragment } = React;
        ${code}

        const __Component = typeof App !== "undefined"
          ? App
          : (typeof ${componentName} !== "undefined" ? ${componentName} : null);

        if (!__Component) {
          showError("No component found. Make sure a component named 'App' is defined.");
        } else {
          const root = ReactDOM.createRoot(document.getElementById("root"));
          root.render(React.createElement(__Component));
        }
      } catch (err) {
        showError((err && err.stack) || String(err));
      }
    </script>
  </body>
</html>`;
}

export default function LivePreview({
  code,
  isStreaming = false,
}: {
  code: string;
  isStreaming?: boolean;
}) {
  const [debouncedCode, setDebouncedCode] = useState(code);

  // Debounce while streaming; clear immediately when code is removed (e.g. new chat).
  useEffect(() => {
    if (!code) {
      setDebouncedCode("");
      return;
    }
    const id = setTimeout(() => setDebouncedCode(code), 350);
    return () => clearTimeout(id);
  }, [code]);

  const srcDoc = useMemo(
    () => (debouncedCode ? buildSrcDoc(debouncedCode) : ""),
    [debouncedCode],
  );

  if (!debouncedCode) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
        {isStreaming ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin opacity-60" />
            <p className="text-sm">Generating preview...</p>
          </>
        ) : (
          <>
            <Layout className="h-6 w-6 opacity-50" />
            <p className="text-sm">Your component preview will appear here.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <iframe
      key={srcDoc.length}
      title="Live component preview"
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
    />
  );
}
