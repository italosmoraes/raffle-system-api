import { createRaffles } from "./001_create_raffles";
import { createUsers } from "./002_create_users";
import { createTickets } from "./003_create_tickets";
import { addRaffleWinner } from "./004_add_raffle_winner";
import { addBalancePrizeWinnerTicket } from "./005_add_balance_prize_winner_ticket";

export interface Migration {
  name: string;
  up: string;
}

// Append new migrations to the end; never edit one that has already run.
export const migrations: Migration[] = [
  createRaffles,
  createUsers,
  createTickets,
  addRaffleWinner,
  addBalancePrizeWinnerTicket,
];
