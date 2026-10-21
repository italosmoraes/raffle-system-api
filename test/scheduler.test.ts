import { describe, expect, it } from "bun:test";
import { createApplication } from "difunkt";
import { SchedulerModule } from "../src/core/scheduler/scheduler.module";
import { Scheduler } from "../src/core/scheduler/scheduler.provider";

const createScheduler = async () => (await createApplication(SchedulerModule))(Scheduler);

describe("Scheduler.every", () => {
  it("runs immediately and then on every interval until stopped", async () => {
    const scheduler = await createScheduler();
    let runs = 0;

    const stop = scheduler.every("test", 10, () => runs++);
    expect(runs).toBe(1);

    await Bun.sleep(35);
    stop();
    const runsAtStop = runs;
    await Bun.sleep(30);

    expect(runsAtStop).toBeGreaterThanOrEqual(3);
    expect(runs).toBe(runsAtStop);
  });

  it("skips ticks while the previous run is still in progress", async () => {
    const scheduler = await createScheduler();
    let started = 0;

    scheduler.every("slow", 5, async () => {
      started++;
      await Bun.sleep(40);
    });
    await Bun.sleep(30);
    scheduler.stopAll();

    expect(started).toBe(1);
  });

  it("keeps running after a task throws", async () => {
    const scheduler = await createScheduler();
    let runs = 0;
    const originalError = console.error;
    console.error = () => {};

    scheduler.every("flaky", 10, () => {
      runs++;
      throw new Error("boom");
    });
    await Bun.sleep(25);
    scheduler.stopAll();
    console.error = originalError;

    expect(runs).toBeGreaterThanOrEqual(2);
  });
});
