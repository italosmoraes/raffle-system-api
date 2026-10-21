import { createProvider } from "difunkt";

type Task = () => unknown | Promise<unknown>;

export const Scheduler = createProvider(() => {
  const stops = new Set<() => void>();

  return {
    // Runs `task` now and then every `intervalMs`. A tick is skipped while the
    // previous run is still going, and errors are logged instead of stopping the loop.
    every(name: string, intervalMs: number, task: Task) {
      let running = false;

      const tick = async () => {
        if (running) return;
        running = true;
        try {
          await task();
        } catch (error) {
          console.error(`[scheduler] ${name} failed`, error);
        } finally {
          running = false;
        }
      };

      const timer = setInterval(tick, intervalMs);
      const stop = () => {
        clearInterval(timer);
        stops.delete(stop);
      };
      stops.add(stop);
      void tick();

      return stop;
    },

    stopAll() {
      for (const stop of stops) stop();
    },
  };
});
