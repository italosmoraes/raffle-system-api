import { createModule } from "difunkt";
import { Scheduler } from "./scheduler.provider";

export const SchedulerModule = createModule({
  providers: [Scheduler],
});
