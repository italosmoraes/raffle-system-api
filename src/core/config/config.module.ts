import { createModule } from "difunkt";
import { ConfigService } from "./config.provider";

export const ConfigModule = createModule({
  providers: [ConfigService],
});
