import { describe, expect, it } from "bun:test";
import { provide } from "difunkt";
import { RaffleRepositoryToken } from "../src/features/raffle/raffle.providers";
import { RaffleService } from "../src/features/raffle/raffle.service";
import type { RaffleRepository } from "../src/features/raffle/raffle.types";
import { createTestApp, NOW } from "./helpers";

const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

const validRaffle = (overrides: Record<string, unknown> = {}) => ({
  title: "Win a bike",
  prize: "Road bike",
  description: "A brand new road bike",
  ticketPriceCents: 500,
  maxTickets: 100,
  drawAt: inDays(7),
  ...overrides,
});

describe("POST /raffles", () => {
  it("creates a raffle", async () => {
    const { request } = await createTestApp();
    const res = await request("POST", "/raffles", validRaffle());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: 1,
      title: "Win a bike",
      prize: "Road bike",
      description: "A brand new road bike",
      ticketPriceCents: 500,
      maxTickets: 100,
      ticketsSold: 0,
      ticketsRemaining: 100,
      status: "open",
      drawAt: inDays(7),
      winningNumber: null,
      drawnAt: null,
      createdAt: NOW.toISOString(),
    });
  });

  it("rejects a drawAt in the past", async () => {
    const { request } = await createTestApp();
    const res = await request("POST", "/raffles", validRaffle({ drawAt: inDays(-1) }));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "drawAt must be in the future" });
  });

  it.each([
    ["missing title", { title: undefined }],
    ["missing prize", { prize: undefined }],
    ["empty title", { title: "" }],
    ["zero price", { ticketPriceCents: 0 }],
    ["fractional price", { ticketPriceCents: 4.5 }],
    ["zero max tickets", { maxTickets: 0 }],
    ["invalid date", { drawAt: "next tuesday" }],
  ])("rejects %s", async (_, overrides) => {
    const { request } = await createTestApp();
    const res = await request("POST", "/raffles", validRaffle(overrides));

    expect(res.status).toBe(422);
  });
});

describe("GET /raffles", () => {
  it("lists raffles ordered by draw date", async () => {
    const { request } = await createTestApp();
    await request("POST", "/raffles", validRaffle({ title: "Later", drawAt: inDays(10) }));
    await request("POST", "/raffles", validRaffle({ title: "Sooner", drawAt: inDays(2) }));

    const res = await request("GET", "/raffles");
    const body = (await res.json()) as { title: string }[];

    expect(res.status).toBe(200);
    expect(body.map((r) => r.title)).toEqual(["Sooner", "Later"]);
  });

  it("paginates with limit and offset", async () => {
    const { request } = await createTestApp();
    for (let day = 1; day <= 3; day++) {
      await request("POST", "/raffles", validRaffle({ title: `Day ${day}`, drawAt: inDays(day) }));
    }

    const res = await request("GET", "/raffles?limit=1&offset=1");
    const body = (await res.json()) as { title: string }[];

    expect(body.map((r) => r.title)).toEqual(["Day 2"]);
  });

  it("lists only active raffles by default", async () => {
    const { request, advanceTime, resolve } = await createTestApp();
    await request("POST", "/raffles", validRaffle({ title: "Due soon", drawAt: inDays(1) }));
    await request("POST", "/raffles", validRaffle({ title: "To be drawn", drawAt: inDays(2) }));
    await request("POST", "/raffles", validRaffle({ title: "Active", drawAt: inDays(10) }));
    advanceTime(3 * 86_400_000);
    // "To be drawn" is drawn; "Due soon" is past its draw time but not drawn yet.
    resolve(RaffleService).markDrawn(2, null);

    const titles = async (query: string) =>
      ((await (await request("GET", `/raffles${query}`)).json()) as { title: string }[]).map(
        (r) => r.title,
      );

    expect(await titles("")).toEqual(["Active"]);
    expect(await titles("?status=active")).toEqual(["Active"]);
    expect(await titles("?status=drawn")).toEqual(["To be drawn"]);
    expect(await titles("?status=all")).toEqual(["Due soon", "To be drawn", "Active"]);
  });

  it("rejects an unknown status", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/raffles?status=bogus");

    expect(res.status).toBe(422);
  });
});

describe("GET /raffles/:id", () => {
  it("returns the raffle", async () => {
    const { request } = await createTestApp();
    await request("POST", "/raffles", validRaffle());

    const res = await request("GET", "/raffles/1");

    expect(res.status).toBe(200);
    expect(((await res.json()) as { title: string }).title).toBe("Win a bike");
  });

  it("returns 404 when the raffle does not exist", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/raffles/999");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Raffle 999 not found" });
  });

  it("rejects a non-numeric id", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/raffles/abc");

    expect(res.status).toBe(422);
  });
});

describe("RaffleService", () => {
  it("defaults to active raffles and the first page", async () => {
    let received: unknown;
    const fakeRepository: RaffleRepository = {
      findById: () => null,
      findByIds: () => [],
      reserveTickets: () => null,
      findDue: () => [],
      markDrawn: () => false,
      findMany: (filter) => {
        received = filter;
        return [];
      },
      create: () => {
        throw new Error("not used");
      },
    };

    const { resolve } = await createTestApp([
      provide(RaffleRepositoryToken, { factory: () => fakeRepository }),
    ]);
    resolve(RaffleService).list();

    expect(received).toEqual({ scope: "active", now: NOW.toISOString(), limit: 20, offset: 0 });
  });
});
