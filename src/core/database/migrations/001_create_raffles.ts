import type { Migration } from ".";

export const createRaffles: Migration = {
  name: "001_create_raffles",
  up: `
    CREATE TABLE raffles (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      title              TEXT    NOT NULL,
      description        TEXT,
      ticket_price_cents INTEGER NOT NULL CHECK (ticket_price_cents > 0),
      max_tickets        INTEGER NOT NULL CHECK (max_tickets > 0),
      tickets_sold       INTEGER NOT NULL DEFAULT 0
                         CHECK (tickets_sold BETWEEN 0 AND max_tickets),
      status             TEXT    NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'drawn')),
      draw_at            TEXT    NOT NULL,
      created_at         TEXT    NOT NULL
    );

    CREATE INDEX idx_raffles_status_draw_at ON raffles (status, draw_at);
  `,
};
