import { createProvider } from "difunkt";

export interface AppConfig {
  port: number;
  databasePath: string;
  sessionTtlHours: number;
  // How often the draw job checks for due raffles; 0 disables it.
  drawIntervalSeconds: number;
  // Balance every new user starts with (no payment integration).
  initialBalanceCents: number;
}

export const loadConfig = (): AppConfig => ({
  port: Number(Bun.env.PORT ?? 3000),
  databasePath: Bun.env.DATABASE_PATH ?? "raffle.sqlite",
  sessionTtlHours: Number(Bun.env.SESSION_TTL_HOURS ?? 24 * 7),
  drawIntervalSeconds: Number(Bun.env.DRAW_INTERVAL_SECONDS ?? 30),
  initialBalanceCents: Number(Bun.env.INITIAL_BALANCE_CENTS ?? 10_000),
});

export const ConfigService = createProvider(loadConfig);
