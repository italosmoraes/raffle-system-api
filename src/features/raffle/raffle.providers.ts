import { createProviderToken } from "difunkt";
import type { RaffleRepository } from "./raffle.types";

export const RaffleRepositoryToken =
  createProviderToken<RaffleRepository>("RaffleRepository");
