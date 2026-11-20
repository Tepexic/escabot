// Builds data/f1.db from the Jolpica-F1 CSV dump (CC BY-NC-SA 4.0).
// Usage: node scripts/build-db.mjs [path/to/dump.zip]   (downloads the dump when no path is given)
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const DUMP_URL = 'https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv';
const OUT = 'data/f1.db';
// Empty in the dump, or only used to compute points (already stored per entry).
const SKIP = new Set(['baseteam', 'penalty', 'pointsystem', 'championshipsystem', 'championshipadjustment']);

// Minimal RFC 4180 parser: quoted fields, "" escapes, commas/newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
assert.deepEqual(parseCsv('a,"b,""c"""\r\n1,\n'), [['a', 'b,"c"'], ['1', '']]);

// '' → NULL, Postgres booleans → 1/0. NUMERIC column affinity turns numeric text into
// INTEGER/REAL, so ORDER BY points works and positions read as 1, not 1.0.
const toValue = (v) => (v === '' ? null : v === 't' ? 1 : v === 'f' ? 0 : v);

const work = mkdtempSync(join(tmpdir(), 'jolpica-'));
try {
  let zip = process.argv[2];
  if (!zip) {
    console.log('Downloading dump…');
    const res = await fetch(DUMP_URL);
    if (!res.ok) throw new Error(`Dump download failed: HTTP ${res.status}`);
    zip = join(work, 'dump.zip');
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync('unzip', ['-q', '-o', zip, '-d', join(work, 'csv')]);

  mkdirSync('data', { recursive: true });
  rmSync(OUT, { force: true });
  const db = new DatabaseSync(OUT);

  const csvDir = join(work, 'csv');
  for (const file of readdirSync(csvDir).filter((f) => f.endsWith('.csv'))) {
    const table = file.replace(/^formula_one_/, '').replace(/\.csv$/, '');
    if (SKIP.has(table)) continue;
    const [header, ...rows] = parseCsv(readFileSync(join(csvDir, file), 'utf8'));
    const keep = header.map((h, i) => (h === 'api_id' ? -1 : i)).filter((i) => i >= 0);
    const cols = keep.map((i) => `"${header[i]}"`);
    db.exec(`CREATE TABLE "${table}" (${cols.map((c) => `${c} NUMERIC`).join(', ')})`);
    const insert = db.prepare(`INSERT INTO "${table}" VALUES (${cols.map(() => '?').join(', ')})`);
    db.exec('BEGIN');
    for (const r of rows) insert.run(...keep.map((i) => toValue(r[i] ?? '')));
    db.exec('COMMIT');
    console.log(`${table}: ${rows.length} rows`);
  }

  db.exec(readFileSync('db/build.sql', 'utf8'));
  db.exec('VACUUM');
  const { max } = db.prepare('SELECT MAX(year) AS max FROM races').get();
  assert.equal(max, 2025, 'races should end in 2025');
  db.close();
  console.log(`Wrote ${OUT}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
