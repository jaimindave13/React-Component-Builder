"use client";

import { useCallback, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import PreviewPanel from "@/components/PreviewPanel";

export default function Home() {
  const [code, setCode] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleCode = useCallback((next: string) => setCode(next), []);
  const handleStreaming = useCallback((s: boolean) => setIsStreaming(s), []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <ChatPanel onCode={handleCode} onStreamingChange={handleStreaming} />
      <PreviewPanel code={code} isStreaming={isStreaming} />
    </main>
  );
}
