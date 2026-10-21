import { describe, expect, it } from "bun:test";
import { createTestApp, NOW } from "./helpers";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function setup(raffle: Record<string, unknown> = {}) {
  const ctx = await createTestApp();
  await ctx.request("POST", "/raffles", {
    title: "Win a bike",
    prize: "Road bike",
    ticketPriceCents: 500,
    maxTickets: 5,
    drawAt: new Date(NOW.getTime() + 7 * DAY).toISOString(),
    ...raffle,
  });
  const token = await ctx.registerAndLogin();
  const buy = (quantity: number, raffleId = 1, as = token) =>
    ctx.request("POST", `/raffles/${raffleId}/tickets`, { quantity }, as);

  return { ...ctx, token, buy };
}

type Purchase = { totalCents: number; tickets: { number: number }[] };

describe("POST /raffles/:id/tickets", () => {
  it("buys tickets with sequential numbers", async () => {
    const { buy, request } = await setup();

    const res = await buy(2);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      raffleId: 1,
      quantity: 2,
      totalCents: 1000,
      tickets: [
        { id: 1, raffleId: 1, number: 1, priceCents: 500, purchasedAt: NOW.toISOString() },
        { id: 2, raffleId: 1, number: 2, priceCents: 500, purchasedAt: NOW.toISOString() },
      ],
    });

    const raffle = (await (await request("GET", "/raffles/1")).json()) as { ticketsSold: number };
    expect(raffle.ticketsSold).toBe(2);
  });

  it("continues numbering across buyers", async () => {
    const { buy, registerAndLogin } = await setup();
    await buy(2);
    const other = await registerAndLogin("grace@example.com");

    const body = (await (await buy(1, 1, other)).json()) as Purchase;

    expect(body.tickets.map((t) => t.number)).toEqual([3]);
  });

  it("requires authentication", async () => {
    const { request } = await setup();
    const res = await request("POST", "/raffles/1/tickets", { quantity: 1 });

    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown raffle", async () => {
    const { buy } = await setup();
    const res = await buy(1, 999);

    expect(res.status).toBe(404);
  });

  it.each([0, 101, 1.5])("rejects quantity %p", async (quantity) => {
    const { buy } = await setup();
    const res = await buy(quantity);

    expect(res.status).toBe(422);
  });

  it("rejects buying more than the remaining tickets", async () => {
    const { buy, request } = await setup();
    await buy(4);

    const res = await buy(2);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Only 1 tickets left" });
    const raffle = (await (await request("GET", "/raffles/1")).json()) as { ticketsSold: number };
    expect(raffle.ticketsSold).toBe(4);
  });

  it("rejects buying from a sold-out raffle", async () => {
    const { buy } = await setup();
    await buy(5);

    const res = await buy(1);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Raffle is sold out" });
  });

  it("rejects buying once the draw time has passed", async () => {
    const { buy, advanceTime } = await setup({
      drawAt: new Date(NOW.getTime() + HOUR).toISOString(),
    });
    advanceTime(HOUR);

    const res = await buy(1);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Raffle is closed for ticket sales" });
  });

  it("deducts the total from the buyer's balance", async () => {
    const { buy, request, token } = await setup();
    await buy(3);

    const me = (await (await request("GET", "/users/me", undefined, token)).json()) as {
      balanceCents: number;
    };

    expect(me.balanceCents).toBe(10_000 - 3 * 500);
  });

  it("rejects a purchase the balance does not cover and changes nothing", async () => {
    const { buy, request, token } = await setup({ ticketPriceCents: 4_000 });
    await buy(2);

    const res = await buy(1);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Insufficient balance" });
    const me = (await (await request("GET", "/users/me", undefined, token)).json()) as {
      balanceCents: number;
    };
    const raffle = (await (await request("GET", "/raffles/1")).json()) as { ticketsSold: number };
    const mine = (await (await request("GET", "/users/me/tickets", undefined, token)).json()) as {
      tickets: unknown[];
    }[];
    expect(me.balanceCents).toBe(2_000);
    expect(raffle.ticketsSold).toBe(2);
    expect(mine[0]!.tickets).toHaveLength(2);
  });

  it("rolls back the reservation if saving the tickets fails", async () => {
    const { buy, request, resolve } = await setup();
    const { DatabaseService } = await import("../src/core/database/database.provider");
    // Make the insert fail after the seats have been claimed.
    resolve(DatabaseService).exec("DROP TABLE tickets");

    const res = await buy(2);

    expect(res.status).toBe(500);
    const raffle = (await (await request("GET", "/raffles/1")).json()) as { ticketsSold: number };
    expect(raffle.ticketsSold).toBe(0);
  });
});

describe("GET /users/me/tickets", () => {
  it("groups the user's tickets by raffle, soonest draw first", async () => {
    const { buy, request, token, registerAndLogin } = await setup({
      drawAt: new Date(NOW.getTime() + 9 * DAY).toISOString(),
    });
    await request("POST", "/raffles", {
      title: "Win a car",
      prize: "Car",
      ticketPriceCents: 1000,
      maxTickets: 10,
      drawAt: new Date(NOW.getTime() + 3 * DAY).toISOString(),
    });
    await buy(2, 1);
    await buy(1, 2);
    const other = await registerAndLogin("grace@example.com");
    await buy(1, 1, other);

    const res = await request("GET", "/users/me/tickets", undefined, token);
    const body = (await res.json()) as { raffle: { title: string }; tickets: { number: number }[] }[];

    expect(res.status).toBe(200);
    expect(body.map((g) => [g.raffle.title, g.tickets.map((t) => t.number)])).toEqual([
      ["Win a car", [1]],
      ["Win a bike", [1, 2]],
    ]);
  });

  it("marks the group as won only for the holder of the winning number", async () => {
    const { buy, request, token, registerAndLogin, advanceTime, resolve } = await setup({
      drawAt: new Date(NOW.getTime() + HOUR).toISOString(),
    });
    await buy(1);
    const other = await registerAndLogin("grace@example.com");
    await buy(1, 1, other);
    advanceTime(HOUR);
    const { DrawService } = await import("../src/features/draw");
    const [result] = resolve(DrawService).runDueDraws();

    const mine = (await (await request("GET", "/users/me/tickets", undefined, token)).json()) as { won: boolean }[];
    const theirs = (await (await request("GET", "/users/me/tickets", undefined, other)).json()) as { won: boolean }[];

    expect([mine[0]!.won, theirs[0]!.won]).toEqual(
      result!.winningNumber === 1 ? [true, false] : [false, true],
    );
  });

  it("returns an empty list when the user has no tickets", async () => {
    const { request, token } = await setup();
    const res = await request("GET", "/users/me/tickets", undefined, token);

    expect(await res.json()).toEqual([]);
  });

  it("requires authentication", async () => {
    const { request } = await setup();
    const res = await request("GET", "/users/me/tickets");

    expect(res.status).toBe(401);
  });
});
