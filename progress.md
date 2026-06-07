# Component Builder — Progress Summary

This document summarizes the work completed to build the **Component Builder** app: a Next.js application that uses the Cursor SDK to generate React components from natural-language prompts, with a live preview and copyable source code.

---

## Project Goal

Build a component builder app with:

- **Next.js + TypeScript + Tailwind CSS**
- **Cursor SDK** for LLM calls (streaming)
- **Chat panel** with a Generate button
- **Live preview** of generated components on the right
- **Code view** with syntax highlighting and copy support
- **UX-friendly, attractive UI**

All of the above has been implemented and verified working.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| LLM integration | `@cursor/sdk` v1.0.18 |
| Code display | `react-syntax-highlighter` |
| Icons | `lucide-react` |
| Utilities | `clsx`, `tailwind-merge` |
| React | 19.2.4 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │   ChatPanel      │         │     PreviewPanel          │  │
│  │   (left ~40%)    │         │     (right ~60%)          │  │
│  │                  │         │  ┌─────────┬──────────┐  │  │
│  │  • Chat history  │         │  │ Preview │   Code   │  │  │
│  │  • Textarea      │         │  └─────────┴──────────┘  │  │
│  │  • Generate btn  │         │  LivePreview / CodeView   │  │
│  └────────┬─────────┘         └──────────────────────────┘  │
│           │ POST /api/generate (SSE)                         │
└───────────┼─────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Route (Node.js runtime)             │
│  app/api/generate/route.ts                                   │
│  • Agent.create / Agent.resume                               │
│  • agent.send() + run.stream()                               │
│  • Streams tokens as Server-Sent Events (SSE)                │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Cursor SDK (@cursor/sdk)                        │
│  Local runtime — runs against project cwd                    │
│  Model: composer-2.5 (configurable via CURSOR_MODEL_ID)    │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
app/
  layout.tsx              Root layout (Geist fonts, dark theme)
  page.tsx                Split-pane shell (ChatPanel + PreviewPanel)
  globals.css             Dark theme, custom scrollbars
  api/
    generate/
      route.ts            Cursor SDK streaming endpoint (SSE)

components/
  ChatPanel.tsx           Message history, textarea, Generate/Stop buttons
  PreviewPanel.tsx        Preview / Code tab switcher
  LivePreview.tsx         Sandboxed iframe (Tailwind + Babel + React CDN)
  CodeView.tsx            Syntax-highlighted code with copy button

lib/
  cn.ts                   clsx + tailwind-merge helper
  extract-code.ts         Parses fenced code blocks from LLM output

.env.local.example        Template for CURSOR_API_KEY
next.config.ts            serverExternalPackages: ["@cursor/sdk"]
tsconfig.json             ES2022 target (for SDK disposal patterns)
README.md                 Setup and usage instructions
progress.md               This file
```

---

## Features Implemented

### Chat Panel (Left)

- Scrollable message history with user/assistant bubbles
- Example prompt suggestions when empty
- Multi-line textarea with **Generate** button
- **Stop** button while streaming
- ⌘/Ctrl + Enter shortcut to generate
- Streaming indicator and error display
- Follow-up prompts resume the same agent (conversation context preserved)
- Assistant replies show a friendly summary instead of dumping raw code into chat

### Preview Panel (Right)

- **Preview** tab — live sandboxed iframe rendering
- **Code** tab — syntax-highlighted TSX with line numbers
- **Copy** button with checkmark feedback
- **Reload** button to remount the preview iframe
- "Generating" indicator during streaming

### Live Preview Strategy

1. The LLM is prompted to return a single `App` React component using Tailwind, with no imports.
2. `lib/extract-code.ts` parses the first fenced `tsx`/`jsx` block from the streamed response.
3. `LivePreview.tsx` injects the code into a sandboxed `<iframe srcDoc>` with:
   - Tailwind CDN
   - React 18 UMD
   - Babel standalone (for JSX/TSX transpilation in-browser)
4. Import/export statements are stripped; the component is mounted automatically.

This approach avoids Tailwind JIT class-pruning and requires no bundler for preview.

### API Route (`/api/generate`)

- **Runtime:** Node.js (`export const runtime = "nodejs"`)
- **Streaming:** Server-Sent Events (SSE)
- **Request body:** `{ prompt, agentId? }`
- **Events emitted:** `agent`, `run`, `delta`, `done`, `error`
- **Error handling:** Distinguishes `CursorAgentError` (startup failure) from run failures (`result.status === "error"`)
- **Agent lifecycle:** Uses `Agent.create` for first prompt, `Agent.resume` for follow-ups; agent is disposed in `finally`

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CURSOR_API_KEY` | Yes | User API key from Cursor dashboard → API Keys |
| `CURSOR_MODEL_ID` | No | Defaults to `composer-2.5` |

### Setup Steps

1. `npm install`
2. `cp .env.local.example .env.local`
3. Add your `CURSOR_API_KEY` to `.env.local`
4. **Save the file** (ensure auto-save is on or manually save)
5. `npm run dev`
6. Open http://localhost:3000

### Next.js Config

`@cursor/sdk` is listed in `serverExternalPackages` so Turbopack does not bundle the Node-only SDK (which spawns local executors and child processes).

---

## Troubleshooting Completed

During setup, authentication failed with **"Invalid User API Key"**. Root causes identified and resolved:

### 1. Wrong API key source

- Keys from some dashboard sections may not work with the SDK.
- **Correct location:** Cursor dashboard → **API Keys** → **User API Keys** → **New API Key**
- The SDK accepts User API keys (including Admin-scoped user keys). Team Admin API keys are not supported.

### 2. Placeholder key in `.env.local`

- The file contained `cursor_your_key_here` (placeholder from `.env.local.example`) instead of the real key.
- **Cause:** Auto-save was off; edits were visible in the editor but never written to disk.
- **Fix:** Save `.env.local` (Cmd+S), then restart `npm run dev`.

### 3. Dev server not restarted after env change

- Next.js reads `.env.local` only at startup.
- After updating the key, the dev server must be fully restarted (Ctrl+C, then `npm run dev`).

### 4. Debug endpoint (temporary)

- A `/api/debug` route was added to diagnose auth: raw HTTP calls to Cursor APIs, SDK `Cursor.me()`, and `Agent.create()`.
- It confirmed the placeholder key (20 chars, prefix `cursor_you...`) vs. a valid key (~74 chars, prefix `crsr_...`).
- The debug route was removed after auth was working.

---

## Current Status

| Item | Status |
|------|--------|
| Project scaffold | ✅ Complete |
| Dependencies installed | ✅ Complete |
| API route with Cursor SDK streaming | ✅ Complete |
| Chat panel with Generate/Stop | ✅ Complete |
| Live preview (iframe) | ✅ Complete |
| Code view with copy | ✅ Complete |
| Split-pane UI | ✅ Complete |
| Environment configuration | ✅ Complete |
| Production build (`npm run build`) | ✅ Passes |
| Authentication / generation | ✅ Working |

---

## How to Use

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000
3. Type a component description (e.g. "A pricing page with three tiers")
4. Click **Generate** (or ⌘/Ctrl + Enter)
5. Watch the preview update on the right as code streams in
6. Switch to **Code** tab to view/copy the full source
7. Send follow-up prompts to refine the component (same agent context is kept)

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

---

## Notes & Recommendations

- **Pro plan:** Local SDK agents require a Cursor Pro plan (free tier may hit `plan_required` on model validation).
- **Key security:** Do not commit `.env.local`. Rotate any API key that was shared in chat or logs.
- **Auto-save:** Keep auto-save enabled when editing `.env.local` to avoid the placeholder-key issue.
- **Key format:** User API keys from the dashboard typically use the `crsr_` prefix; length should be ~70+ characters.

---

## Possible Future Enhancements

- Export/download generated component as a `.tsx` file
- History of generated components (local storage or database)
- Model selector in the UI
- Cloud agent runtime option (for CI/remote repos)
- Improved error messages in the chat panel for common auth failures

---

*Last updated: June 7, 2026*
