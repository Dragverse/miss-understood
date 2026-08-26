/**
 * Verify the creator-board migrations actually landed.
 *
 * There is no staging database (see CREATOR_BOARD_ARCHITECTURE.md), so
 * migrations are applied by hand in the Supabase SQL editor and this is how we
 * confirm the result.
 *
 *   npx tsx scripts/verify-board-migrations.mts
 *
 * NOTE: never use `{ head: true }` for an existence check. PostgREST returns no
 * body for a HEAD request, so supabase-js reports no error even when the table
 * is missing — a missing table reads as a pass. Always select a real row.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures++;
}

const MIGRATIONS: Record<string, string[]> = {
  "profile-blocks": ["profile_blocks", "creator_themes", "guestbook_entries", "featured_friends"],
  events: ["events", "event_interests"],
  subscriptions: ["subscription_tiers", "subscriptions"],
};

for (const [migration, tables] of Object.entries(MIGRATIONS)) {
  for (const table of tables) {
    const { error, count } = await db.from(table).select("*", { count: "exact" }).limit(1);
    check(`${migration}: ${table}`, !error, error ? error.message : `rows=${count}`);
  }
}

// Backfills: every creator should have a board and a free tier.
const { count: creators } = await db.from("creators").select("*", { count: "exact" }).limit(1);
const { data: blockRows } = await db.from("profile_blocks").select("creator_did");
const { data: tierRows } = await db.from("subscription_tiers").select("creator_did");

const boarded = new Set((blockRows ?? []).map((r) => r.creator_did)).size;
const tiered = new Set((tierRows ?? []).map((r) => r.creator_did)).size;

check("every creator has a board", boarded === creators, `${boarded}/${creators}`);
check("every creator has a free tier", tiered === creators, `${tiered}/${creators}`);

console.log(failures === 0 ? "\nAll migrations verified." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
