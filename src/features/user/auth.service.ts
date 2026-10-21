import { createProvider } from "difunkt";
import { Clock } from "../../core/clock/clock.provider";
import { ConfigService } from "../../core/config/config.provider";
import { UnauthorizedError } from "../../core/http/errors";
import { PasswordHasherToken, SessionRepositoryToken, UserRepositoryToken } from "./user.providers";
import { normalizeEmail } from "./user.service";
import type { LoginInput, User } from "./user.types";

// Only a hash of the token is stored, so a leaked database does not leak usable tokens.
const hashToken = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");

const generateToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

export const AuthService = createProvider(({ inject }) => {
  const users = inject(UserRepositoryToken);
  const sessions = inject(SessionRepositoryToken);
  const hasher = inject(PasswordHasherToken);
  const clock = inject(Clock);
  const { sessionTtlHours } = inject(ConfigService);

  return {
    async login(input: LoginInput) {
      const user = users.findByEmailWithPassword(normalizeEmail(input.email));
      const valid = user !== null && (await hasher.verify(input.password, user.passwordHash));
      if (!user || !valid) throw new UnauthorizedError("Invalid email or password");

      const now = clock.now();
      const expiresAt = new Date(now.getTime() + sessionTtlHours * 3_600_000).toISOString();
      const token = generateToken();

      sessions.deleteExpired(now.toISOString());
      sessions.create({
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt,
        createdAt: now.toISOString(),
      });

      const { passwordHash: _, ...publicUser } = user;
      return { token, expiresAt, user: publicUser };
    },

    logout(token: string) {
      sessions.delete(hashToken(token));
    },

    authenticate(token: string): User {
      const user = sessions.findActiveUser(hashToken(token), clock.now().toISOString());
      if (!user) throw new UnauthorizedError("Invalid or expired token");
      return user;
    },
  };
});
