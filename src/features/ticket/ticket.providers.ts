import { createProviderToken } from "difunkt";
import type { TicketRepository } from "./ticket.types";

export const TicketRepositoryToken = createProviderToken<TicketRepository>("TicketRepository");
