import { createModule } from "difunkt";
import { DatabaseService } from "./database.provider";
import { runMigrations } from "./migrator";
import { Transaction } from "./transaction.provider";

export const DatabaseModule = createModule({
  providers: [DatabaseService, Transaction],
  runnables: [({ inject }) => runMigrations(inject(DatabaseService))],
});
