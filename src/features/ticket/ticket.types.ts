import { type Static, t } from "elysia";
import { RaffleSchema } from "../raffle";

export const TicketSchema = t.Object({
  id: t.Integer(),
  raffleId: t.Integer(),
  number: t.Integer(),
  priceCents: t.Integer(),
  purchasedAt: t.String({ format: "date-time" }),
});

export const PurchaseTicketsBody = t.Object({
  quantity: t.Integer({ minimum: 1, maximum: 100 }),
});

export const PurchaseSchema = t.Object({
  raffleId: t.Integer(),
  quantity: t.Integer(),
  totalCents: t.Integer(),
  tickets: t.Array(TicketSchema),
});

export const MyRaffleTicketsSchema = t.Object({
  raffle: RaffleSchema,
  tickets: t.Array(TicketSchema),
  // True once the raffle is drawn and one of these tickets holds the winning number.
  won: t.Boolean(),
});

export type Ticket = Static<typeof TicketSchema>;

export type NewTicket = {
  raffleId: number;
  userId: number;
  number: number;
  priceCents: number;
  purchasedAt: string;
};

export interface TicketRepository {
  createMany(tickets: NewTicket[]): Ticket[];
  findByUser(userId: number): Ticket[];
  findByNumber(raffleId: number, number: number): { id: number; userId: number } | null;
}
