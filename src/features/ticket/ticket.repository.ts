import type { ProviderContext } from "difunkt";
import { DatabaseService } from "../../core/database/database.provider";
import type { NewTicket, Ticket, TicketRepository } from "./ticket.types";

const COLUMNS = `
  id,
  raffle_id    AS raffleId,
  number,
  price_cents  AS priceCents,
  purchased_at AS purchasedAt
`;

export const createSqliteTicketRepository = ({ inject }: ProviderContext): TicketRepository => {
  const db = inject(DatabaseService);

  const insert = db.query<Ticket, NewTicket>(
    `INSERT INTO tickets (raffle_id, user_id, number, price_cents, purchased_at)
     VALUES ($raffleId, $userId, $number, $priceCents, $purchasedAt)
     RETURNING ${COLUMNS}`,
  );

  const findByUser = db.query<Ticket, { userId: number }>(
    `SELECT ${COLUMNS} FROM tickets WHERE user_id = $userId ORDER BY raffle_id, number`,
  );

  const findByNumber = db.query<{ id: number; userId: number }, { raffleId: number; number: number }>(
    `SELECT id, user_id AS userId FROM tickets WHERE raffle_id = $raffleId AND number = $number`,
  );

  return {
    // Callers wrap this in a Transaction; inserting row by row is fine for <= 100 rows.
    createMany: (tickets) => tickets.map((ticket) => insert.get(ticket)!),
    findByUser: (userId) => findByUser.all({ userId }),
    findByNumber: (raffleId, number) => findByNumber.get({ raffleId, number }),
  };
};
