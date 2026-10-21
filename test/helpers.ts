import { createApplication, type ModuleProvider, provide } from "difunkt";
import { AppModule, HttpApp } from "../src/app.module";
import { Clock } from "../src/core/clock/clock.provider";
import { type AppConfig, ConfigService } from "../src/core/config/config.provider";
import { PasswordHasherToken } from "../src/features/user/user.providers";
import type { PasswordHasher } from "../src/features/user/user.types";

export const NOW = new Date("2026-01-01T12:00:00.000Z");

const testConfig: AppConfig = {
  port: 0,
  databasePath: ":memory:",
  sessionTtlHours: 24,
  // Tests call DrawService directly instead of running the scheduled job.
  drawIntervalSeconds: 0,
  initialBalanceCents: 10_000,
};

// The production argon2 hasher takes ~150ms per call; cheap bcrypt keeps tests fast.
const fastHasher: PasswordHasher = {
  hash: (password) => Bun.password.hash(password, { algorithm: "bcrypt", cost: 4 }),
  verify: (password, hash) => Bun.password.verify(password, hash),
};

export async function createTestApp(overrides: ModuleProvider[] = []) {
  let now = NOW;

  const resolve = await createApplication(AppModule, {
    providers: [
      provide(ConfigService, { value: testConfig }),
      provide(Clock, { value: { now: () => now } }),
      provide(PasswordHasherToken, { value: fastHasher }),
      ...overrides,
    ],
  });
  const app = resolve(HttpApp);

  const request = (method: string, path: string, body?: unknown, token?: string) => {
    const headers = new Headers();
    if (body !== undefined) headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);

    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  };

  const registerAndLogin = async (email = "ada@example.com", password = "correct-horse") => {
    await request("POST", "/auth/register", { email, name: "Ada", password });
    const res = await request("POST", "/auth/login", { email, password });
    return ((await res.json()) as { token: string }).token;
  };

  const advanceTime = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  return { resolve, app, request, registerAndLogin, advanceTime };
}
