const FENCE_RE = /```(?:tsx|jsx|ts|js|javascript|typescript|react)?\s*\n?/i;

/**
 * Extract the first fenced code block from an assistant message.
 *
 * Tolerant of streaming: while tokens are still arriving the closing fence may
 * not exist yet, so we return whatever has been emitted after the opening fence.
 * Falls back to the raw text when no fence is present at all.
 */
export function extractCode(text: string): string {
  if (!text) return "";

  const openMatch = text.match(FENCE_RE);
  if (!openMatch || openMatch.index === undefined) {
    // No fence yet. If the model emitted bare code, surface it; otherwise wait.
    return looksLikeCode(text) ? text.trim() : "";
  }

  const afterOpen = text.slice(openMatch.index + openMatch[0].length);
  const closeIdx = afterOpen.indexOf("```");
  const body = closeIdx === -1 ? afterOpen : afterOpen.slice(0, closeIdx);

  return body.trim();
}

function looksLikeCode(text: string): boolean {
  return /\b(function|const|class|export|=>|return)\b/.test(text);
}

/**
 * Prepare extracted component code so it can run inside the preview iframe:
 * strip module syntax (import/export) that has no meaning in a single-file
 * Babel-in-browser context, and normalize the default export to `App`.
 */
export function prepareForPreview(code: string): string {
  if (!code) return "";

  let out = code;

  // Drop every import statement (CDN globals provide React, hooks, etc.).
  out = out.replace(/^\s*import\s+[^\n]*\n/gm, "");

  // `export default function Foo` -> `function Foo`
  out = out.replace(/export\s+default\s+function\s+/g, "function ");
  // `export default class Foo` -> `class Foo`
  out = out.replace(/export\s+default\s+class\s+/g, "class ");
  // `export default Foo;` -> `const __default = Foo;`
  out = out.replace(/export\s+default\s+/g, "const __default = ");
  // Strip remaining named exports keyword.
  out = out.replace(/export\s+(const|function|class|let|var)\s+/g, "$1 ");

  return out.trim();
}

/**
 * Find the identifier the preview should mount. Prefers a component literally
 * named `App`, otherwise the first PascalCase function/const declaration.
 */
export function detectComponentName(code: string): string {
  if (/\b(function|const|class)\s+App\b/.test(code)) return "App";

  const fnMatch = code.match(/function\s+([A-Z][A-Za-z0-9_]*)/);
  if (fnMatch) return fnMatch[1];

  const constMatch = code.match(/const\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  if (constMatch) return constMatch[1];

  const defaultMatch = code.match(/const\s+__default\s*=\s*([A-Za-z0-9_]*)/);
  if (defaultMatch && defaultMatch[1]) return defaultMatch[1];

  return "App";
}
