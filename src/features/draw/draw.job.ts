import type { ProviderContext } from "difunkt";
import { ConfigService } from "../../core/config/config.provider";
import { Scheduler } from "../../core/scheduler/scheduler.provider";
import { DrawService } from "./draw.service";

// Runnable: starts the draw loop when the application boots.
export const startDrawJob = ({ inject }: ProviderContext) => {
  const { drawIntervalSeconds } = inject(ConfigService);
  if (drawIntervalSeconds <= 0) return;

  const draws = inject(DrawService);
  inject(Scheduler).every("draw", drawIntervalSeconds * 1000, () => {
    for (const result of draws.runDueDraws()) {
      console.info(
        result.winningNumber === null
          ? `[draw] raffle ${result.raffleId} closed with no tickets sold`
          : `[draw] raffle ${result.raffleId} drawn: ticket #${result.winningNumber} (user ${result.winnerUserId}) wins`,
      );
    }
  });
};
