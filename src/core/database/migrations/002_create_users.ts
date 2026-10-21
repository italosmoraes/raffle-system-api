import type { Migration } from ".";

export const createUsers: Migration = {
  name: "002_create_users",
  up: `
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL
    );

    CREATE TABLE sessions (
      token_hash TEXT    PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    );

    CREATE INDEX idx_sessions_user_id ON sessions (user_id);
  `,
};
