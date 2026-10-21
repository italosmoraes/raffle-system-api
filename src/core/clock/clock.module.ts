import { createModule } from "difunkt";
import { Clock } from "./clock.provider";

export const ClockModule = createModule({
  providers: [Clock],
});
