import { db } from "../api/db/index.js";
import { sql } from "drizzle-orm";

export async function initDatabase(): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,
    persona         TEXT NOT NULL,
    contact_type    TEXT NOT NULL,
    contact_value   TEXT NOT NULL,
    callback_url    TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    registered_at   INTEGER NOT NULL,
    last_seen_at    INTEGER NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS matches (
    id              TEXT PRIMARY KEY,
    agent_a_id      TEXT NOT NULL,
    agent_b_id      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    scene           TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS date_reports (
    id              TEXT PRIMARY KEY,
    match_id        TEXT NOT NULL,
    story           TEXT,
    summary         TEXT,
    error           TEXT,
    generated_at    INTEGER
  )`);

  console.log("Database initialized");
}
