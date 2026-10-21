import { createModule, provide } from "difunkt";
import { RaffleRepositoryToken } from "./raffle.providers";
import { createSqliteRaffleRepository } from "./raffle.repository";
import { RaffleRoutes } from "./raffle.routes";
import { RaffleService } from "./raffle.service";

export const RaffleModule = createModule({
  providers: [
    provide(RaffleRepositoryToken, { factory: createSqliteRaffleRepository }),
    RaffleService,
    RaffleRoutes,
  ],
});
