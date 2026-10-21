import type { Database } from "bun:sqlite";
import { type Migration, migrations } from "./migrations";

export function runMigrations(db: Database, list: Migration[] = migrations) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .query<{ name: string }, []>("SELECT name FROM _migrations")
      .all()
      .map((row) => row.name),
  );

  const record = db.prepare("INSERT INTO _migrations (name) VALUES ($name)");

  for (const migration of list) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.up);
      record.run({ name: migration.name });
    })();
  }
}
