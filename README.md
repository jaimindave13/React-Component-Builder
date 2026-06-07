# Component Builder

A Next.js + TypeScript + Tailwind CSS app that turns natural-language prompts into React components using the [Cursor SDK](https://cursor.com/docs/sdk/typescript). Describe a component in the chat panel, hit **Generate**, and watch it stream in with a live preview and copyable source.

## Features

- Chat interface with streaming responses powered by `@cursor/sdk`
- One-click **Generate** that calls the LLM and renders results in real time
- Split view: **Live Preview** (sandboxed iframe with Tailwind) and **Code** view
- Copy the generated code to your clipboard
- Follow-up edits keep conversation context (the agent is resumed by id)
- Dark, responsive, UX-friendly UI

## Prerequisites

- Node.js 18+
- A Cursor API key from the [Cursor dashboard](https://cursor.com/dashboard/integrations)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure your API key:

```bash
cp .env.local.example .env.local
# then edit .env.local and set CURSOR_API_KEY=cursor_...
```

3. Run the dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## How it works

```
app/api/generate/route.ts  -> Cursor SDK streaming endpoint (SSE, Node runtime)
components/ChatPanel.tsx    -> prompt input, Generate button, streamed messages
components/PreviewPanel.tsx -> Preview / Code tab switcher
components/LivePreview.tsx  -> sandboxed iframe (Tailwind CDN + Babel + React)
components/CodeView.tsx     -> syntax-highlighted code with a copy button
lib/extract-code.ts         -> parses fenced code from the model output
```

The API route uses `Agent.create` / `Agent.resume` plus `agent.send(...).stream()` to
stream assistant tokens as Server-Sent Events. The client extracts the fenced
`tsx` block and renders it inside a sandboxed iframe that loads React, Babel, and
the Tailwind CDN, so any Tailwind class works without a build step.

## Notes

- The route runs on the Node.js runtime because the Cursor SDK spawns a local
  executor. `@cursor/sdk` is declared in `serverExternalPackages` so it is not
  bundled by Turbopack.
- Default model is `composer-2.5`; override with `CURSOR_MODEL_ID` in `.env.local`.
