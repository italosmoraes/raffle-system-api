import type { Migration } from ".";

export const addBalancePrizeWinnerTicket: Migration = {
  name: "005_add_balance_prize_winner_ticket",
  up: `
    ALTER TABLE users ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0
      CHECK (balance_cents >= 0);

    ALTER TABLE raffles ADD COLUMN prize TEXT NOT NULL DEFAULT '';

    -- Kept next to winning_number so the winner (ticket -> user) is recorded explicitly.
    ALTER TABLE raffles ADD COLUMN winning_ticket_id INTEGER REFERENCES tickets (id);
  `,
};
