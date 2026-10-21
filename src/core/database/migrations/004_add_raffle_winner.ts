import type { Migration } from ".";

// Ticket numbers are 1..tickets_sold with no gaps, so the winner is stored as a
// number. A null winning_number on a drawn raffle means no tickets were sold.
export const addRaffleWinner: Migration = {
  name: "004_add_raffle_winner",
  up: `
    ALTER TABLE raffles ADD COLUMN winning_number INTEGER;
    ALTER TABLE raffles ADD COLUMN drawn_at TEXT;
  `,
};
