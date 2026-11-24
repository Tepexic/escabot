import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const MAX_ROWS = 200;

// readOnly: the model writes these queries, so the connection itself cannot write.
const db = new DatabaseSync(path.join(process.cwd(), 'data/f1.db'), { readOnly: true });

// Tables/views the model should use first, with their real columns read from the DB.
const MAIN = [
  'races', 'session_results', 'race_results', 'sprint_results', 'qualifying_results', 'poles',
  'driver_standings_final', 'team_standings_final', 'drivers', 'teams', 'circuits',
];
export const schemaText = MAIN.map((name) => {
  const cols = db.prepare(`SELECT name FROM pragma_table_info(?)`).all(name).map((c) => c.name);
  return `- ${name}(${cols.join(', ')})`;
}).join('\n');

// A fact built straight from one row, so it can't be wrong and costs no tokens.
export function randomFact(): string {
  const r = db
    .prepare(
      `SELECT driver, team, year, COUNT(*) AS wins FROM race_results WHERE position = 1
       GROUP BY driver_ref, team, year HAVING wins >= 3 ORDER BY random() LIMIT 1`,
    )
    .get() as { driver: string; team: string; year: number; wins: number };
  return `${r.driver} ganó ${r.wins} carreras en ${r.year} con ${r.team}.`;
}

export type SqlResult = { rows: Record<string, unknown>[]; truncated: boolean } | { error: string };

// shortcut: no query timeout (node:sqlite has no progress handler); a runaway join is
// cut off by the route's maxDuration. Add one if the logs show slow queries.
export function runSql(query: string): SqlResult {
  const q = query.trim().replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(q) || q.includes(';')) {
    return { error: 'Solo se permite una consulta SELECT (sin punto y coma intermedio).' };
  }
  try {
    const rows: Record<string, unknown>[] = [];
    for (const row of db.prepare(q).iterate()) {
      if (rows.length === MAX_ROWS) return { rows, truncated: true };
      rows.push(row as Record<string, unknown>);
    }
    return { rows, truncated: false };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
