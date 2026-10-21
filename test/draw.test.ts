import { describe, expect, it } from "bun:test";
import { provide } from "difunkt";
import { DrawService } from "../src/features/draw";
import { RandomIntToken } from "../src/features/draw/draw.providers";
import { createTestApp, NOW } from "./helpers";

const HOUR = 3_600_000;

type Raffle = { status: string; winningNumber: number | null; drawnAt: string | null };

async function setup(pick: (min: number, max: number) => number = (min) => min) {
  const calls: [number, number][] = [];
  const ctx = await createTestApp([
    provide(RandomIntToken, {
      value: (min: number, max: number) => {
        calls.push([min, max]);
        return pick(min, max);
      },
    }),
  ]);

  const createRaffle = (hoursUntilDraw = 1) =>
    ctx.request("POST", "/raffles", {
      title: "Win a bike",
      prize: "Road bike",
      ticketPriceCents: 500,
      maxTickets: 10,
      drawAt: new Date(NOW.getTime() + hoursUntilDraw * HOUR).toISOString(),
    });

  const token = await ctx.registerAndLogin();
  const buy = (quantity: number, raffleId = 1) =>
    ctx.request("POST", `/raffles/${raffleId}/tickets`, { quantity }, token);

  const getRaffle = async (id = 1) => (await (await ctx.request("GET", `/raffles/${id}`)).json()) as Raffle;

  return { ...ctx, calls, createRaffle, buy, getRaffle, draws: ctx.resolve(DrawService) };
}

describe("DrawService.runDueDraws", () => {
  it("draws a winner among the sold ticket numbers once the draw time passes", async () => {
    const { createRaffle, buy, advanceTime, draws, getRaffle, calls } = await setup((_, max) => max - 1);
    await createRaffle();
    await buy(3);
    advanceTime(HOUR);

    const results = draws.runDueDraws();

    expect(calls).toEqual([[1, 4]]);
    expect(results).toEqual([{ raffleId: 1, winningNumber: 3, winningTicketId: 3, winnerUserId: 1 }]);
    expect(await getRaffle()).toMatchObject({
      status: "drawn",
      winningNumber: 3,
      drawnAt: new Date(NOW.getTime() + HOUR).toISOString(),
    });
  });

  it("records the winning ticket, whose owner is the winner", async () => {
    const { createRaffle, buy, advanceTime, draws, resolve, registerAndLogin, request } = await setup(
      (_, max) => max - 1,
    );
    await createRaffle();
    await buy(1);
    const grace = await registerAndLogin("grace@example.com");
    await request("POST", "/raffles/1/tickets", { quantity: 1 }, grace);
    advanceTime(HOUR);

    draws.runDueDraws();

    const { DatabaseService } = await import("../src/core/database/database.provider");
    const winner = resolve(DatabaseService)
      .query(
        `SELECT t.number, u.email FROM raffles r
         JOIN tickets t ON t.id = r.winning_ticket_id
         JOIN users u ON u.id = t.user_id
         WHERE r.id = 1`,
      )
      .get();
    expect(winner).toEqual({ number: 2, email: "grace@example.com" });
  });

  it("leaves raffles that are not due yet", async () => {
    const { createRaffle, buy, draws, getRaffle } = await setup();
    await createRaffle();
    await buy(1);

    expect(draws.runDueDraws()).toEqual([]);
    expect((await getRaffle()).status).toBe("open");
  });

  it("closes a raffle with no tickets sold without a winner", async () => {
    const { createRaffle, advanceTime, draws, getRaffle, calls } = await setup();
    await createRaffle();
    advanceTime(HOUR);

    expect(draws.runDueDraws()).toEqual([
      { raffleId: 1, winningNumber: null, winningTicketId: null, winnerUserId: null },
    ]);
    expect(calls).toEqual([]);
    expect(await getRaffle()).toMatchObject({ status: "drawn", winningNumber: null });
  });

  it("draws each raffle only once", async () => {
    const { createRaffle, buy, advanceTime, draws } = await setup();
    await createRaffle();
    await buy(2);
    advanceTime(HOUR);

    draws.runDueDraws();

    expect(draws.runDueDraws()).toEqual([]);
    expect(draws.draw(1)).toBeNull();
  });

  it("draws every due raffle, oldest first", async () => {
    const { createRaffle, advanceTime, draws } = await setup();
    await createRaffle(3);
    await createRaffle(1);
    await createRaffle(5);
    advanceTime(4 * HOUR);

    expect(draws.runDueDraws().map((r) => r.raffleId)).toEqual([2, 1]);
  });

  it("keeps drawing other raffles when one fails", async () => {
    let call = 0;
    const { createRaffle, buy, advanceTime, draws, getRaffle } = await setup((min) => {
      if (call++ === 0) throw new Error("random source unavailable");
      return min;
    });
    await createRaffle(1);
    await createRaffle(2);
    await buy(1, 1);
    await buy(1, 2);
    advanceTime(2 * HOUR);

    const results = draws.runDueDraws();

    expect(results).toEqual([{ raffleId: 2, winningNumber: 1, winningTicketId: 2, winnerUserId: 1 }]);
    expect((await getRaffle(1)).status).toBe("open");
  });

  it("stops ticket sales for a drawn raffle", async () => {
    const { createRaffle, buy, advanceTime, draws } = await setup();
    await createRaffle();
    advanceTime(HOUR);
    draws.runDueDraws();

    const res = await buy(1);

    expect(res.status).toBe(409);
  });
});
