import { createModule, createProvider } from "difunkt";
import { ClockModule } from "./core/clock/clock.module";
import { ConfigModule } from "./core/config/config.module";
import { DatabaseModule } from "./core/database/database.module";
import { createHttpApp } from "./core/http/http";
import { SchedulerModule } from "./core/scheduler/scheduler.module";
import { DrawModule } from "./features/draw";
import { RaffleModule, RaffleRoutes } from "./features/raffle";
import { TicketModule, TicketRoutes } from "./features/ticket";
import { UserModule, UserRoutes } from "./features/user";

export const HttpApp = createProvider(({ inject }) =>
  createHttpApp()
    .use(inject(UserRoutes))
    .use(inject(RaffleRoutes))
    .use(inject(TicketRoutes)),
);

// Modules are flat (one shared container), so core modules are imported once
// here rather than by each feature; otherwise their runnables run per import.
// Order matters for runnables: migrations (DatabaseModule) run before the draw job starts.
export const AppModule = createModule({
  imports: [
    ConfigModule,
    ClockModule,
    DatabaseModule,
    SchedulerModule,
    UserModule,
    RaffleModule,
    TicketModule,
    DrawModule,
  ],
  providers: [HttpApp],
});
