import type { Migration } from ".";

export const createTickets: Migration = {
  name: "003_create_tickets",
  up: `
    CREATE TABLE tickets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      raffle_id    INTEGER NOT NULL REFERENCES raffles (id),
      user_id      INTEGER NOT NULL REFERENCES users (id),
      number       INTEGER NOT NULL CHECK (number > 0),
      price_cents  INTEGER NOT NULL CHECK (price_cents > 0),
      purchased_at TEXT    NOT NULL,
      UNIQUE (raffle_id, number)
    );

    CREATE INDEX idx_tickets_user_id ON tickets (user_id);
  `,
};
