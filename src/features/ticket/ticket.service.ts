import { createProvider } from "difunkt";
import { Clock } from "../../core/clock/clock.provider";
import { Transaction } from "../../core/database/transaction.provider";
import { NotFoundError } from "../../core/http/errors";
import { RaffleService } from "../raffle";
import { UserService } from "../user";
import { TicketRepositoryToken } from "./ticket.providers";
import type { Ticket } from "./ticket.types";

export const TicketService = createProvider(({ inject }) => {
  const tickets = inject(TicketRepositoryToken);
  const raffles = inject(RaffleService);
  const users = inject(UserService);
  const transaction = inject(Transaction);
  const clock = inject(Clock);

  return {
    // Seats, balance and tickets change together or not at all.
    purchase(userId: number, raffleId: number, quantity: number) {
      return transaction(() => {
        const { raffle, firstNumber } = raffles.reserveTickets(raffleId, quantity);
        const totalCents = raffle.ticketPriceCents * quantity;
        users.debit(userId, totalCents);

        const purchasedAt = clock.now().toISOString();
        const created = tickets.createMany(
          Array.from({ length: quantity }, (_, i) => ({
            raffleId,
            userId,
            number: firstNumber + i,
            priceCents: raffle.ticketPriceCents,
            purchasedAt,
          })),
        );

        return { raffleId, quantity, totalCents, tickets: created };
      });
    },

    listForUser(userId: number) {
      const byRaffle = new Map<number, Ticket[]>();
      for (const ticket of tickets.findByUser(userId)) {
        const group = byRaffle.get(ticket.raffleId) ?? [];
        group.push(ticket);
        byRaffle.set(ticket.raffleId, group);
      }

      return raffles
        .getMany([...byRaffle.keys()])
        .sort((a, b) => a.drawAt.localeCompare(b.drawAt) || a.id - b.id)
        .map((raffle) => {
          const owned = byRaffle.get(raffle.id)!;
          const won = owned.some((ticket) => ticket.number === raffle.winningNumber);
          return { raffle, tickets: owned, won };
        });
    },

    // Used by the draw to turn a winning number into the ticket and its owner.
    getByNumber(raffleId: number, number: number) {
      const ticket = tickets.findByNumber(raffleId, number);
      if (!ticket) throw new NotFoundError(`Ticket ${number} of raffle ${raffleId} not found`);
      return ticket;
    },
  };
});
