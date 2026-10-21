import { describe, expect, it } from "bun:test";
import { RaffleService } from "../src/features/raffle";
import { SEED_PASSWORD, seed, seedUsers } from "../scripts/seed";
import { createTestApp, NOW } from "./helpers";

describe("seed", () => {
  it("creates users with their balances and raffles, including a quick draw", async () => {
    const { resolve, request } = await createTestApp();

    const { createdUsers, createdRaffles } = await seed(resolve, 2);

    expect(createdUsers).toEqual(seedUsers.map((u) => u.email));
    expect(createdRaffles).toHaveLength(3);
    expect(createdRaffles[0]!.drawAt).toBe(new Date(NOW.getTime() + 2 * 60_000).toISOString());

    for (const user of seedUsers) {
      const login = await request("POST", "/auth/login", { email: user.email, password: SEED_PASSWORD });
      const body = (await login.json()) as { user: { balanceCents: number } };
      expect(body.user.balanceCents).toBe(user.balanceCents);
    }
  });

  it("is idempotent", async () => {
    const { resolve } = await createTestApp();
    await seed(resolve);

    const second = await seed(resolve);

    expect(second).toEqual({ createdUsers: [], createdRaffles: [] });
    expect(resolve(RaffleService).list({ status: "all" })).toHaveLength(3);
  });
});
