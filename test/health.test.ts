import { describe, expect, it } from "bun:test";
import { createTestApp } from "./helpers";

describe("GET /health", () => {
  it("returns ok", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/nope");

    expect(res.status).toBe(404);
  });
});
