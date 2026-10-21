import { createModule, provide } from "difunkt";
import { startDrawJob } from "./draw.job";
import { RandomIntToken, secureRandomInt } from "./draw.providers";
import { DrawService } from "./draw.service";

export const DrawModule = createModule({
  providers: [provide(RandomIntToken, { value: secureRandomInt }), DrawService],
  runnables: [startDrawJob],
});
