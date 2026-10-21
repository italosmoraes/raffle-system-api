import { type Static, t } from "elysia";

export const RaffleStatusSchema = t.UnionEnum(["open", "drawn"]);

export const RaffleSchema = t.Object({
  id: t.Integer(),
  title: t.String(),
  prize: t.String(),
  description: t.Nullable(t.String()),
  ticketPriceCents: t.Integer(),
  maxTickets: t.Integer(),
  ticketsSold: t.Integer(),
  ticketsRemaining: t.Integer(),
  status: RaffleStatusSchema,
  drawAt: t.String({ format: "date-time" }),
  winningNumber: t.Nullable(t.Integer()),
  drawnAt: t.Nullable(t.String({ format: "date-time" })),
  createdAt: t.String({ format: "date-time" }),
});

export const CreateRaffleBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  prize: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  ticketPriceCents: t.Integer({ minimum: 1 }),
  maxTickets: t.Integer({ minimum: 1, maximum: 100_000 }),
  drawAt: t.String({ format: "date-time" }),
});

// active: open for ticket sales (open and before its draw time).
export const RaffleScopeSchema = t.UnionEnum(["active", "drawn", "all"]);

export const ListRafflesQuery = t.Object({
  status: t.Optional(RaffleScopeSchema),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
});

export const RaffleIdParams = t.Object({
  id: t.Integer({ minimum: 1 }),
});

export type RaffleStatus = Static<typeof RaffleStatusSchema>;
export type RaffleScope = Static<typeof RaffleScopeSchema>;
export type Raffle = Static<typeof RaffleSchema>;
export type CreateRaffleInput = Static<typeof CreateRaffleBody>;

export type RaffleFilter = {
  scope: RaffleScope;
  now: string;
  limit: number;
  offset: number;
};

export type NewRaffle = {
  title: string;
  prize: string;
  description: string | null;
  ticketPriceCents: number;
  maxTickets: number;
  drawAt: string;
  createdAt: string;
};

export type MarkDrawn = {
  winningNumber: number | null;
  winningTicketId: number | null;
  drawnAt: string;
};

export interface RaffleRepository {
  findById(id: number): Raffle | null;
  findMany(filter: RaffleFilter): Raffle[];
  findByIds(ids: number[]): Raffle[];
  create(raffle: NewRaffle): Raffle;
  // Atomically adds `quantity` to tickets_sold if the raffle is open, before its
  // draw time and has room. Returns the new tickets_sold, or null if not possible.
  reserveTickets(id: number, quantity: number, now: string): number | null;
  findDue(now: string, limit: number): Raffle[];
  // Moves an open raffle to drawn. Returns false if it was not open (already drawn).
  markDrawn(id: number, draw: MarkDrawn): boolean;
}
