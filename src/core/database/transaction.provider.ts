import { createProvider } from "difunkt";
import { DatabaseService } from "./database.provider";

// Runs `fn` inside a write transaction (BEGIN IMMEDIATE), rolling back if it throws.
// Nested calls become savepoints. Repositories are synchronous, so `fn` must be too.
export const Transaction = createProvider(({ inject }) => {
  const db = inject(DatabaseService);
  return <T>(fn: () => T): T => db.transaction(fn).immediate();
});
