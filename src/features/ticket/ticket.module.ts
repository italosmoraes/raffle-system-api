import { createModule, provide } from "difunkt";
import { TicketRepositoryToken } from "./ticket.providers";
import { createSqliteTicketRepository } from "./ticket.repository";
import { TicketRoutes } from "./ticket.routes";
import { TicketService } from "./ticket.service";

export const TicketModule = createModule({
  providers: [
    provide(TicketRepositoryToken, { factory: createSqliteTicketRepository }),
    TicketService,
    TicketRoutes,
  ],
});
