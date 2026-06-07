import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export interface ChatSummary {
  id: string;
  title: string;
  agentId: string | null;
  latestCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  sortOrder: number;
  createdAt: number;
}

export interface ChatWithMessages extends ChatSummary {
  messages: ChatMessage[];
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "chats.db");

let db: Database.Database | undefined;

function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      agent_id TEXT,
      latest_code TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
  `);
}

function rowToSummary(row: {
  id: string;
  title: string;
  agent_id: string | null;
  latest_code: string | null;
  created_at: number;
  updated_at: number;
}): ChatSummary {
  return {
    id: row.id,
    title: row.title,
    agentId: row.agent_id,
    latestCode: row.latest_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  sort_order: number;
  created_at: number;
}): ChatMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role as "user" | "assistant",
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function listChats(): ChatSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT id, title, agent_id, latest_code, created_at, updated_at
       FROM chats
       ORDER BY updated_at DESC`,
    )
    .all() as Array<{
    id: string;
    title: string;
    agent_id: string | null;
    latest_code: string | null;
    created_at: number;
    updated_at: number;
  }>;

  return rows.map(rowToSummary);
}

export function getChat(id: string): ChatWithMessages | null {
  const row = getDb()
    .prepare(
      `SELECT id, title, agent_id, latest_code, created_at, updated_at
       FROM chats WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        title: string;
        agent_id: string | null;
        latest_code: string | null;
        created_at: number;
        updated_at: number;
      }
    | undefined;

  if (!row) return null;

  const messageRows = getDb()
    .prepare(
      `SELECT id, chat_id, role, content, sort_order, created_at
       FROM messages
       WHERE chat_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(id) as Array<{
    id: string;
    chat_id: string;
    role: string;
    content: string;
    sort_order: number;
    created_at: number;
  }>;

  return {
    ...rowToSummary(row),
    messages: messageRows.map(rowToMessage),
  };
}

export function createChat(id: string, title: string): ChatSummary {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO chats (id, title, agent_id, latest_code, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, ?, ?)`,
    )
    .run(id, title, now, now);

  return {
    id,
    title,
    agentId: null,
    latestCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateChat(
  id: string,
  patch: { title?: string; agentId?: string | null; latestCode?: string | null },
): ChatSummary | null {
  const existing = getDb().prepare(`SELECT id FROM chats WHERE id = ?`).get(id);
  if (!existing) return null;

  const sets: string[] = ["updated_at = ?"];
  const values: Array<string | number | null> = [Date.now()];

  if (patch.title !== undefined) {
    sets.push("title = ?");
    values.push(patch.title);
  }
  if (patch.agentId !== undefined) {
    sets.push("agent_id = ?");
    values.push(patch.agentId);
  }
  if (patch.latestCode !== undefined) {
    sets.push("latest_code = ?");
    values.push(patch.latestCode);
  }

  values.push(id);
  getDb()
    .prepare(`UPDATE chats SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);

  return getChat(id);
}

export function addMessage(
  chatId: string,
  message: { id: string; role: "user" | "assistant"; content: string },
): ChatMessage | null {
  const chat = getDb().prepare(`SELECT id FROM chats WHERE id = ?`).get(chatId);
  if (!chat) return null;

  const now = Date.now();
  const sortOrder = (
    getDb()
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM messages WHERE chat_id = ?`)
      .get(chatId) as { next: number }
  ).next;

  getDb()
    .prepare(
      `INSERT INTO messages (id, chat_id, role, content, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(message.id, chatId, message.role, message.content, sortOrder, now);

  getDb().prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`).run(now, chatId);

  return {
    id: message.id,
    chatId,
    role: message.role,
    content: message.content,
    sortOrder,
    createdAt: now,
  };
}

export function deleteChat(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM chats WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function chatTitleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 48) return trimmed || "New chat";
  return `${trimmed.slice(0, 48)}…`;
}
