// Returns an integer in [min, max).
export type RandomInt = (min: number, max: number) => number;

export type DrawResult =
  | { raffleId: number; winningNumber: number; winningTicketId: number; winnerUserId: number }
  | { raffleId: number; winningNumber: null; winningTicketId: null; winnerUserId: null };
