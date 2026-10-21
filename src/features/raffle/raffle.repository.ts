import type { ProviderContext } from "difunkt";
import { DatabaseService } from "../../core/database/database.provider";
import type {
  MarkDrawn,
  NewRaffle,
  Raffle,
  RaffleFilter,
  RaffleRepository,
} from "./raffle.types";

// winning_ticket_id is recorded but not selected: public responses expose only the number.
const COLUMNS = `
  id,
  title,
  prize,
  description,
  ticket_price_cents         AS ticketPriceCents,
  max_tickets                AS maxTickets,
  tickets_sold               AS ticketsSold,
  max_tickets - tickets_sold AS ticketsRemaining,
  status,
  draw_at                    AS drawAt,
  winning_number             AS winningNumber,
  drawn_at                   AS drawnAt,
  created_at                 AS createdAt
`;

export const createSqliteRaffleRepository = ({ inject }: ProviderContext): RaffleRepository => {
  const db = inject(DatabaseService);

  const findById = db.query<Raffle, { id: number }>(
    `SELECT ${COLUMNS} FROM raffles WHERE id = $id`,
  );

  const findByIds = db.query<Raffle, { ids: string }>(
    `SELECT ${COLUMNS} FROM raffles WHERE id IN (SELECT value FROM json_each($ids))`,
  );

  const findMany = db.query<Raffle, RaffleFilter>(
    `SELECT ${COLUMNS} FROM raffles
     WHERE $scope = 'all'
        OR ($scope = 'active' AND status = 'open' AND draw_at > $now)
        OR ($scope = 'drawn' AND status = 'drawn')
     ORDER BY draw_at ASC, id ASC
     LIMIT $limit OFFSET $offset`,
  );

  const insert = db.query<Raffle, NewRaffle>(
    `INSERT INTO raffles (title, prize, description, ticket_price_cents, max_tickets, draw_at, created_at)
     VALUES ($title, $prize, $description, $ticketPriceCents, $maxTickets, $drawAt, $createdAt)
     RETURNING ${COLUMNS}`,
  );

  const reserve = db.query<{ ticketsSold: number }, { id: number; quantity: number; now: string }>(
    `UPDATE raffles SET tickets_sold = tickets_sold + $quantity
     WHERE id = $id
       AND status = 'open'
       AND draw_at > $now
       AND tickets_sold + $quantity <= max_tickets
     RETURNING tickets_sold AS ticketsSold`,
  );

  const findDue = db.query<Raffle, { now: string; limit: number }>(
    `SELECT ${COLUMNS} FROM raffles
     WHERE status = 'open' AND draw_at <= $now
     ORDER BY draw_at ASC, id ASC
     LIMIT $limit`,
  );

  const markDrawn = db.query<null, MarkDrawn & { id: number }>(
    `UPDATE raffles
     SET status = 'drawn',
         winning_number = $winningNumber,
         winning_ticket_id = $winningTicketId,
         drawn_at = $drawnAt
     WHERE id = $id AND status = 'open'`,
  );

  return {
    findById: (id) => findById.get({ id }),
    findByIds: (ids) => (ids.length === 0 ? [] : findByIds.all({ ids: JSON.stringify(ids) })),
    findMany: (filter) => findMany.all(filter),
    create: (raffle) => insert.get(raffle)!,
    reserveTickets: (id, quantity, now) => reserve.get({ id, quantity, now })?.ticketsSold ?? null,
    findDue: (now, limit) => findDue.all({ now, limit }),
    markDrawn: (id, draw) => markDrawn.run({ id, ...draw }).changes > 0,
  };
};
