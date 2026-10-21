import { createProvider } from "difunkt";
import { Elysia, t } from "elysia";
import { RaffleIdParams } from "../raffle";
import { AuthPlugin } from "../user";
import { TicketService } from "./ticket.service";
import { MyRaffleTicketsSchema, PurchaseSchema, PurchaseTicketsBody } from "./ticket.types";

export const TicketRoutes = createProvider(({ inject }) => {
  const tickets = inject(TicketService);

  return new Elysia()
    .use(inject(AuthPlugin))
    .post(
      "/raffles/:id/tickets",
      ({ params, body, user, status }) =>
        status(201, tickets.purchase(user.id, params.id, body.quantity)),
      {
        auth: true,
        params: RaffleIdParams,
        body: PurchaseTicketsBody,
        response: { 201: PurchaseSchema },
      },
    )
    .get("/users/me/tickets", ({ user }) => tickets.listForUser(user.id), {
      auth: true,
      response: t.Array(MyRaffleTicketsSchema),
    });
});
