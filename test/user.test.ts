import { describe, expect, it } from "bun:test";
import { createTestApp, NOW } from "./helpers";

const ada = { email: "ada@example.com", name: "Ada", password: "correct-horse" };

describe("POST /auth/register", () => {
  it("creates a user without exposing the password", async () => {
    const { request } = await createTestApp();
    const res = await request("POST", "/auth/register", ada);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: 1,
      email: "ada@example.com",
      name: "Ada",
      balanceCents: 10_000,
      createdAt: NOW.toISOString(),
    });
  });

  it("lowercases the email", async () => {
    const { request } = await createTestApp();
    const res = await request("POST", "/auth/register", { ...ada, email: "Ada@Example.COM" });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { email: string }).email).toBe("ada@example.com");
  });

  it("rejects a duplicate email regardless of case", async () => {
    const { request } = await createTestApp();
    await request("POST", "/auth/register", ada);
    const res = await request("POST", "/auth/register", { ...ada, email: "ADA@example.com" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Email is already registered" });
  });

  it.each([
    ["invalid email", { email: "not-an-email" }],
    ["short password", { password: "short" }],
    ["empty name", { name: "" }],
  ])("rejects %s", async (_, overrides) => {
    const { request } = await createTestApp();
    const res = await request("POST", "/auth/register", { ...ada, ...overrides });

    expect(res.status).toBe(422);
  });
});

describe("POST /auth/login", () => {
  it("returns a token, its expiry and the user", async () => {
    const { request } = await createTestApp();
    await request("POST", "/auth/register", ada);

    const res = await request("POST", "/auth/login", { email: ada.email, password: ada.password });
    const body = (await res.json()) as { token: string; expiresAt: string; user: unknown };

    expect(res.status).toBe(200);
    expect(body.token).toBeString();
    expect(body.expiresAt).toBe(new Date(NOW.getTime() + 24 * 3_600_000).toISOString());
    expect(body.user).toEqual({
      id: 1,
      email: ada.email,
      name: "Ada",
      balanceCents: 10_000,
      createdAt: NOW.toISOString(),
    });
  });

  it("rejects a wrong password", async () => {
    const { request } = await createTestApp();
    await request("POST", "/auth/register", ada);

    const res = await request("POST", "/auth/login", { email: ada.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid email or password" });
  });

  it("rejects an unknown email with the same message", async () => {
    const { request } = await createTestApp();
    const res = await request("POST", "/auth/login", { email: "nobody@example.com", password: "whatever1" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid email or password" });
  });
});

describe("GET /users/me", () => {
  it("returns the authenticated user", async () => {
    const { request, registerAndLogin } = await createTestApp();
    const token = await registerAndLogin();

    const res = await request("GET", "/users/me", undefined, token);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { email: string }).email).toBe(ada.email);
  });

  it("requires a token", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/users/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Missing bearer token" });
  });

  it("rejects an unknown token", async () => {
    const { request } = await createTestApp();
    const res = await request("GET", "/users/me", undefined, "made-up-token");

    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { request, registerAndLogin, advanceTime } = await createTestApp();
    const token = await registerAndLogin();

    advanceTime(24 * 3_600_000);
    const res = await request("GET", "/users/me", undefined, token);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid or expired token" });
  });
});

describe("POST /auth/logout", () => {
  it("revokes the token", async () => {
    const { request, registerAndLogin } = await createTestApp();
    const token = await registerAndLogin();

    const logout = await request("POST", "/auth/logout", undefined, token);
    const me = await request("GET", "/users/me", undefined, token);

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
  });
});
