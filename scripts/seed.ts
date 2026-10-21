import { type ContainerResolverFunction, createApplication, provide } from "difunkt";
import { AppModule } from "../src/app.module";
import { Clock } from "../src/core/clock/clock.provider";
import { ConfigService, loadConfig } from "../src/core/config/config.provider";
import { DatabaseService } from "../src/core/database/database.provider";
import { ConflictError } from "../src/core/http/errors";
import { RaffleService } from "../src/features/raffle";
import { UserService } from "../src/features/user";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const SEED_PASSWORD = "password123";

export const seedUsers = [
  { email: "alice@example.com", name: "Alice", balanceCents: 10_000 },
  // Low balance, to show the insufficient-balance check.
  { email: "bob@example.com", name: "Bob", balanceCents: 300 },
];

// Idempotent: existing users are skipped and raffles are only created on an empty database.
export async function seed(resolve: ContainerResolverFunction, quickDrawMinutes = 2) {
  const users = resolve(UserService);
  const raffles = resolve(RaffleService);
  const now = resolve(Clock).now().getTime();
  const at = (ms: number) => new Date(now + ms).toISOString();

  const createdUsers: string[] = [];
  for (const { balanceCents, ...user } of seedUsers) {
    try {
      await users.register({ ...user, password: SEED_PASSWORD }, { balanceCents });
      createdUsers.push(user.email);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
    }
  }

  const hasRaffles = raffles.list({ status: "all", limit: 1 }).length > 0;
  const createdRaffles = hasRaffles
    ? []
    : [
        raffles.create({
          title: "Quick draw",
          prize: "$50 gift card",
          description: "Draws a few minutes after seeding, so you can watch the draw job.",
          ticketPriceCents: 200,
          maxTickets: 20,
          drawAt: at(quickDrawMinutes * MINUTE),
        }),
        raffles.create({
          title: "Gaming laptop giveaway",
          prize: "Gaming laptop",
          ticketPriceCents: 1_000,
          maxTickets: 50,
          drawAt: at(3 * DAY),
        }),
        raffles.create({
          title: "Summer bike raffle",
          prize: "Carbon road bike",
          ticketPriceCents: 500,
          maxTickets: 100,
          drawAt: at(7 * DAY),
        }),
      ];

  return { createdUsers, createdRaffles };
}

if (import.meta.main) {
  // Draw job off: seeding should not draw anything.
  const config = { ...loadConfig(), drawIntervalSeconds: 0 };
  const resolve = await createApplication(AppModule, {
    providers: [provide(ConfigService, { value: config })],
  });

  const quickDrawMinutes = Number(Bun.env.SEED_QUICK_DRAW_MINUTES ?? 2);
  const { createdUsers, createdRaffles } = await seed(resolve, quickDrawMinutes);
  resolve(DatabaseService).close();

  console.log(`Seeded ${config.databasePath}`);
  console.log(
    createdUsers.length
      ? `  users (password "${SEED_PASSWORD}"): ${createdUsers.join(", ")}`
      : "  users: already present, skipped",
  );
  if (createdRaffles.length === 0) console.log("  raffles: already present, skipped");
  for (const r of createdRaffles) console.log(`  raffle ${r.id}: ${r.title}, draws at ${r.drawAt}`);
}
