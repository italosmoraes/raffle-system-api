import { createProvider } from "difunkt";
import { Clock } from "../../core/clock/clock.provider";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../core/http/errors";
import { RaffleRepositoryToken } from "./raffle.providers";
import type { CreateRaffleInput, RaffleScope } from "./raffle.types";

export const RaffleService = createProvider(({ inject }) => {
  const raffles = inject(RaffleRepositoryToken);
  const clock = inject(Clock);

  const get = (id: number) => {
    const raffle = raffles.findById(id);
    if (!raffle) throw new NotFoundError(`Raffle ${id} not found`);
    return raffle;
  };

  return {
    get,

    getMany: (ids: number[]) => raffles.findByIds(ids),

    // Defaults to active raffles: the ones users can still buy tickets for.
    list(filter: { status?: RaffleScope; limit?: number; offset?: number } = {}) {
      return raffles.findMany({
        scope: filter.status ?? "active",
        now: clock.now().toISOString(),
        limit: filter.limit ?? 20,
        offset: filter.offset ?? 0,
      });
    },

    create(input: CreateRaffleInput) {
      const now = clock.now();
      const drawAt = new Date(input.drawAt);
      if (drawAt <= now) throw new BusinessRuleError("drawAt must be in the future");

      return raffles.create({
        title: input.title,
        prize: input.prize,
        description: input.description ?? null,
        ticketPriceCents: input.ticketPriceCents,
        maxTickets: input.maxTickets,
        drawAt: drawAt.toISOString(),
        createdAt: now.toISOString(),
      });
    },

    // Claims `quantity` seats and returns the raffle plus the first claimed ticket number.
    // Call it inside a Transaction together with the ticket inserts, so a failed insert
    // rolls the counter back.
    reserveTickets(id: number, quantity: number) {
      const now = clock.now().toISOString();
      const ticketsSold = raffles.reserveTickets(id, quantity, now);

      if (ticketsSold === null) {
        const raffle = get(id);
        if (raffle.status !== "open" || raffle.drawAt <= now) {
          throw new ConflictError("Raffle is closed for ticket sales");
        }
        throw new ConflictError(
          raffle.ticketsRemaining === 0
            ? "Raffle is sold out"
            : `Only ${raffle.ticketsRemaining} tickets left`,
        );
      }

      return { raffle: get(id), firstNumber: ticketsSold - quantity + 1 };
    },

    // Open raffles whose draw time has passed, oldest first.
    listDue(limit = 50) {
      return raffles.findDue(clock.now().toISOString(), limit);
    },

    markDrawn(id: number, winner: { number: number; ticketId: number } | null) {
      return raffles.markDrawn(id, {
        winningNumber: winner?.number ?? null,
        winningTicketId: winner?.ticketId ?? null,
        drawnAt: clock.now().toISOString(),
      });
    },
  };
});
