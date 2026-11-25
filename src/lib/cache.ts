import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
const file = process.env.WRAPPING_CACHE_PATH || (process.env.VERCEL ? join("/tmp", "wrapping-cache.sqlite") : join(process.cwd(), "data", "cache.sqlite"));
let db: Database.Database | undefined;
function database() { if (!db) { mkdirSync(dirname(file), { recursive: true }); db = new Database(file); db.pragma("journal_mode = WAL"); db.exec("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL)"); } return db; }
export function cacheGet<T>(key: string): T | null { const row = database().prepare("SELECT value, expires_at FROM cache WHERE key = ?").get(key) as {value:string;expires_at:number}|undefined; if (!row || row.expires_at < Date.now()) { if(row) database().prepare("DELETE FROM cache WHERE key = ?").run(key); return null; } try { return JSON.parse(row.value) as T; } catch { return null; } }
export function cacheSet(key: string, value: unknown, ttlMs = 6*60*60*1000) { database().prepare("INSERT OR REPLACE INTO cache (key,value,expires_at) VALUES (?,?,?)").run(key,JSON.stringify(value),Date.now()+ttlMs); }
