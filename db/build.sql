-- Runs after the raw CSV import. Raw tables keep Jolpica's names; the tables below
-- them are the flat, readable surface the agent queries first.

-- Keep seasons 1950–2025 only (the dump includes the current season).
DELETE FROM season WHERE year > 2025;
DELETE FROM round WHERE season_id NOT IN (SELECT id FROM season);
DELETE FROM session WHERE round_id NOT IN (SELECT id FROM round);
DELETE FROM roundentry WHERE round_id NOT IN (SELECT id FROM round);
DELETE FROM sessionentry WHERE session_id NOT IN (SELECT id FROM session);
DELETE FROM teamdriver WHERE season_id NOT IN (SELECT id FROM season);
DELETE FROM lap WHERE session_entry_id NOT IN (SELECT id FROM sessionentry);
DELETE FROM pitstop WHERE session_entry_id NOT IN (SELECT id FROM sessionentry);
DELETE FROM driverchampionship WHERE year > 2025;
DELETE FROM teamchampionship WHERE year > 2025;
DELETE FROM driver WHERE id NOT IN (SELECT driver_id FROM teamdriver);
DELETE FROM team WHERE id NOT IN (SELECT team_id FROM teamdriver);

-- shortcut: lap-by-lap times (743k rows, 63 MB of 90) are dropped; only each entry's
-- fastest lap stays. Re-import `lap` from the dump if lap-by-lap questions are needed.
ALTER TABLE pitstop ADD COLUMN lap;
UPDATE pitstop SET lap = (SELECT number FROM lap WHERE lap.id = pitstop.lap_id);
ALTER TABLE pitstop DROP COLUMN lap_id;
DELETE FROM lap WHERE is_entry_fastest_lap IS NOT 1;
ALTER TABLE lap RENAME TO fastest_lap;
CREATE INDEX fastest_lap_entry ON fastest_lap (session_entry_id);
CREATE INDEX pitstop_entry ON pitstop (session_entry_id);

-- One row per Grand Prix weekend.
CREATE TABLE races AS
SELECT s.year, r.number AS round, r.name AS race, r.date, r.is_cancelled AS cancelled,
       c.name AS circuit, c.reference AS circuit_ref, c.locality, c.country
FROM round r
JOIN season s ON s.id = r.season_id
JOIN circuit c ON c.id = r.circuit_id;

-- One row per driver per session (race, sprint, qualifying, practice).
CREATE TABLE session_results AS
SELECT s.year, r.number AS round, r.name AS race, r.date, c.name AS circuit, c.country,
       ss.type AS session_type, ss.number AS session_number,
       d.reference AS driver_ref, d.forename || ' ' || d.surname AS driver, d.nationality,
       t.name AS team, t.reference AS team_ref, re.car_number,
       se.grid, se.position, se.is_classified AS classified,
       CASE se.status
         WHEN 0 THEN 'Finished' WHEN 1 THEN 'Lapped' WHEN 10 THEN 'Accident'
         WHEN 11 THEN 'Retired' WHEN 20 THEN 'Disqualified' WHEN 30 THEN 'Did not start'
         WHEN 40 THEN 'Did not qualify' WHEN 41 THEN 'Did not prequalify'
       END AS status,
       se.detail, se.points, se.laps_completed AS laps, se.time, se.fastest_lap_rank,
       -- Qualifying and practice times only exist here.
       (SELECT fl.time FROM fastest_lap fl WHERE fl.session_entry_id = se.id LIMIT 1) AS best_lap_time
FROM sessionentry se
JOIN session ss ON ss.id = se.session_id
JOIN round r ON r.id = ss.round_id
JOIN season s ON s.id = r.season_id
JOIN circuit c ON c.id = r.circuit_id
JOIN roundentry re ON re.id = se.round_entry_id
JOIN teamdriver td ON td.id = re.team_driver_id
JOIN driver d ON d.id = td.driver_id
JOIN team t ON t.id = td.team_id;
CREATE INDEX session_results_driver ON session_results (driver_ref, session_type);
CREATE INDEX session_results_race ON session_results (year, round, session_type);

CREATE VIEW race_results AS SELECT * FROM session_results WHERE session_type = 'R';
CREATE VIEW sprint_results AS SELECT * FROM session_results WHERE session_type = 'SR';
-- Qualifying sessions only exist from 1994 on.
CREATE VIEW qualifying_results AS
SELECT * FROM session_results WHERE session_type IN ('Q1', 'Q2', 'Q3', 'QA', 'QB', 'QO');
-- Pole = started the race from grid 1. Matches official pole totals (Hamilton 104,
-- Senna 65, Schumacher 68) better than qualifying rows, which are missing before 1994.
CREATE VIEW poles AS SELECT * FROM race_results WHERE grid = 1;

-- Final championship standings: the last standings row of each season.
CREATE TABLE driver_standings_final AS
SELECT dc.year, dc.position, d.reference AS driver_ref, d.forename || ' ' || d.surname AS driver,
       d.nationality, dc.points, dc.win_count AS wins
FROM driverchampionship dc
JOIN driver d ON d.id = dc.driver_id
JOIN (SELECT year, MAX(round_number * 100 + session_number) AS k FROM driverchampionship GROUP BY year) last
  ON last.year = dc.year AND dc.round_number * 100 + dc.session_number = last.k;

CREATE TABLE team_standings_final AS
SELECT tc.year, tc.position, t.reference AS team_ref, t.name AS team, tc.points, tc.win_count AS wins
FROM teamchampionship tc
JOIN team t ON t.id = tc.team_id
JOIN (SELECT year, MAX(round_number * 100 + session_number) AS k FROM teamchampionship GROUP BY year) last
  ON last.year = tc.year AND tc.round_number * 100 + tc.session_number = last.k;

CREATE VIEW drivers AS
SELECT reference AS driver_ref, forename, surname, abbreviation, nationality, country_code,
       date_of_birth, permanent_car_number, wikipedia
FROM driver;
CREATE VIEW teams AS SELECT reference AS team_ref, name, nationality, country_code, wikipedia FROM team;
CREATE VIEW circuits AS
SELECT reference AS circuit_ref, name, locality, country, latitude, longitude, altitude, wikipedia
FROM circuit;
