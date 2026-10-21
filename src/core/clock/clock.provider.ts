import { createProvider } from "difunkt";

// Injected instead of calling `new Date()` directly so time can be fixed in tests.
export const Clock = createProvider(() => ({
  now: () => new Date(),
}));
