// Checks data/f1.db against the data-backed answers in evals/golden.json.
// A failure means either the build is wrong or the golden answer is; a human decides which.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/f1.db', { readOnly: true });
const one = (sql) => Object.values(db.prepare(sql).get() ?? {}).join(' ');

const checks = [
  [1, 'Checo wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='perez' AND position=1", '6'],
  [2, 'Checo podiums', "SELECT COUNT(*) FROM race_results WHERE driver_ref='perez' AND position<=3", '39'],
  [3, 'Checo debut', "SELECT team, year FROM race_results WHERE driver_ref='perez' ORDER BY date LIMIT 1", 'Sauber 2011'],
  [4, 'Checo Ferrari wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='perez' AND team LIKE '%Ferrari%'", '0'],
  [5, 'Checo Mexico 2021', "SELECT position FROM race_results WHERE driver_ref='perez' AND year=2021 AND race LIKE 'Mexico%'", '3'],
  [6, 'Pedro Rodríguez wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='rodriguez' AND position=1", '2'],
  [7, 'Ricardo Rodríguez wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='ricardo_rodriguez' AND position=1", '0'],
  [8, 'Mexico 2015 winner', "SELECT driver_ref FROM race_results WHERE year=2015 AND race LIKE 'Mexic%' AND position=1", 'rosberg'],
  [9, 'Last Mexican GP before 2015', "SELECT driver_ref, year FROM race_results WHERE year<2015 AND race LIKE 'Mexic%' AND position=1 ORDER BY year DESC LIMIT 1", 'mansell 1992'],
  [10, 'First F1 race winner', 'SELECT driver_ref, race FROM race_results WHERE position=1 ORDER BY date LIMIT 1', 'farina British Grand Prix'],
  [11, 'Fangio wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='fangio' AND position=1", '24'],
  [12, '2021 champion', 'SELECT driver_ref FROM driver_standings_final WHERE year=2021 AND position=1', 'max_verstappen'],
  [13, '2025 champion', 'SELECT driver_ref FROM driver_standings_final WHERE year=2025 AND position=1', 'norris'],
  [14, 'Most wins 2025', 'SELECT driver_ref, COUNT(*) n FROM race_results WHERE year=2025 AND position=1 GROUP BY 1 ORDER BY n DESC LIMIT 1', 'max_verstappen 8'],
  [15, 'Constructors 2024', 'SELECT team FROM team_standings_final WHERE year=2024 AND position=1', 'McLaren'],
  [16, 'Ferrari constructor titles', "SELECT COUNT(*) FROM team_standings_final WHERE team_ref='ferrari' AND position=1", '16'],
  [17, 'Hamilton titles', "SELECT COUNT(*) FROM driver_standings_final WHERE driver_ref='hamilton' AND position=1", '7'],
  [18, 'Schumacher titles', "SELECT COUNT(*) FROM driver_standings_final WHERE driver_ref='michael_schumacher' AND position=1", '7'],
  [19, 'Most poles', 'SELECT driver_ref, COUNT(*) n FROM poles GROUP BY 1 ORDER BY n DESC LIMIT 1', 'hamilton 104'],
  [20, 'Verstappen wins 2023', "SELECT COUNT(*) FROM race_results WHERE driver_ref='max_verstappen' AND year=2023 AND position=1", '19'],
  [21, 'Senna Monaco wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='senna' AND race LIKE 'Monaco%' AND position=1", '6'],
  [22, 'Leclerc Monaco wins', "SELECT COUNT(*) FROM race_results WHERE driver_ref='leclerc' AND race LIKE 'Monaco%' AND position=1", '1'],
  [23, 'Youngest winner', `SELECT r.driver_ref, r.year FROM race_results r JOIN drivers d USING (driver_ref)
      WHERE r.position=1 ORDER BY julianday(r.date) - julianday(d.date_of_birth) LIMIT 1`, 'max_verstappen 2016'],
  [24, 'GPs in 2024', 'SELECT COUNT(*) FROM races WHERE year=2024 AND NOT cancelled', '24'],
  [25, 'Brazil 2022 sprint winner', "SELECT driver_ref FROM sprint_results WHERE year=2022 AND race LIKE 'S_o Paulo%' AND position=1", 'russell'],
  [26, 'Checo sprint wins', "SELECT COUNT(*) FROM sprint_results WHERE driver_ref='perez' AND position=1", '1'],
];

let failed = 0;
for (const [id, name, sql, expected] of checks) {
  const got = one(sql);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${id} ${name}: ${ok ? got : `expected "${expected}", got "${got}"`}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exitCode = failed ? 1 : 0;
