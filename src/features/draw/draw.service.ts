import { createProvider } from "difunkt";
import { Transaction } from "../../core/database/transaction.provider";
import { RaffleService } from "../raffle";
import { TicketService } from "../ticket";
import { RandomIntToken } from "./draw.providers";
import type { DrawResult } from "./draw.types";

const BATCH_SIZE = 50;

export const DrawService = createProvider(({ inject }) => {
  const raffles = inject(RaffleService);
  const tickets = inject(TicketService);
  const transaction = inject(Transaction);
  const randomInt = inject(RandomIntToken);

  // Returns null if the raffle was already drawn (e.g. by a concurrent run).
  const draw = (raffleId: number): DrawResult | null =>
    transaction(() => {
      // Re-read inside the transaction so ticketsSold is current.
      const raffle = raffles.get(raffleId);
      if (raffle.status !== "open") return null;

      if (raffle.ticketsSold === 0) {
        const drawn = raffles.markDrawn(raffle.id, null);
        return drawn
          ? { raffleId, winningNumber: null, winningTicketId: null, winnerUserId: null }
          : null;
      }

      // Ticket numbers are 1..ticketsSold with no gaps, so every number is a sold ticket.
      const winningNumber = randomInt(1, raffle.ticketsSold + 1);
      const ticket = tickets.getByNumber(raffle.id, winningNumber);
      const drawn = raffles.markDrawn(raffle.id, { number: winningNumber, ticketId: ticket.id });
      return drawn
        ? { raffleId, winningNumber, winningTicketId: ticket.id, winnerUserId: ticket.userId }
        : null;
    });

  return {
    draw,

    // Draws every due raffle. One failing raffle does not stop the others.
    runDueDraws() {
      const results: DrawResult[] = [];
      const failed = new Set<number>();

      for (;;) {
        const due = raffles.listDue(BATCH_SIZE + failed.size).filter((r) => !failed.has(r.id));
        if (due.length === 0) break;

        for (const raffle of due) {
          try {
            const result = draw(raffle.id);
            if (result) results.push(result);
          } catch (error) {
            failed.add(raffle.id);
            console.error(`[draw] raffle ${raffle.id} failed`, error);
          }
        }
      }

      return results;
    },
  };
});
