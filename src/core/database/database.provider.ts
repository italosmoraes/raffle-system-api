import { Database } from "bun:sqlite";
import { createProvider } from "difunkt";
import { ConfigService } from "../config/config.provider";

export const DatabaseService = createProvider(({ inject }) => {
  const { databasePath } = inject(ConfigService);
  const db = new Database(databasePath, { create: true, strict: true });

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  return db;
});
