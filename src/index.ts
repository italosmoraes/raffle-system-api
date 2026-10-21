import { createApplication } from "difunkt";
import { AppModule, HttpApp } from "./app.module";
import { ConfigService } from "./core/config/config.provider";
import { DatabaseService } from "./core/database/database.provider";
import { Scheduler } from "./core/scheduler/scheduler.provider";

const resolve = await createApplication(AppModule);
const { port } = resolve(ConfigService);

const app = resolve(HttpApp).listen(port);
console.log(`Raffle API listening on http://localhost:${port}`);

const shutdown = async () => {
  resolve(Scheduler).stopAll();
  await app.stop();
  resolve(DatabaseService).close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
