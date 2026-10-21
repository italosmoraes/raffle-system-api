import { createProvider } from "difunkt";
import { Clock } from "../../core/clock/clock.provider";
import { ConfigService } from "../../core/config/config.provider";
import { ConflictError, NotFoundError } from "../../core/http/errors";
import { PasswordHasherToken, UserRepositoryToken } from "./user.providers";
import type { RegisterInput } from "./user.types";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const UserService = createProvider(({ inject }) => {
  const users = inject(UserRepositoryToken);
  const hasher = inject(PasswordHasherToken);
  const clock = inject(Clock);
  const { initialBalanceCents } = inject(ConfigService);

  return {
    // `balanceCents` is only for internal callers such as the seed script; the
    // HTTP route always uses the configured starting balance.
    async register(input: RegisterInput, options: { balanceCents?: number } = {}) {
      const user = users.create({
        email: normalizeEmail(input.email),
        name: input.name.trim(),
        passwordHash: await hasher.hash(input.password),
        balanceCents: options.balanceCents ?? initialBalanceCents,
        createdAt: clock.now().toISOString(),
      });
      if (!user) throw new ConflictError("Email is already registered");
      return user;
    },

    get(id: number) {
      const user = users.findById(id);
      if (!user) throw new NotFoundError(`User ${id} not found`);
      return user;
    },

    // Call inside a Transaction with whatever the money pays for.
    debit(id: number, amountCents: number) {
      if (!users.debit(id, amountCents)) throw new ConflictError("Insufficient balance");
    },
  };
});
