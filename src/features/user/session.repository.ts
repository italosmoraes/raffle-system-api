import type { ProviderContext } from "difunkt";
import { DatabaseService } from "../../core/database/database.provider";
import type { NewSession, SessionRepository, User } from "./user.types";

export const createSqliteSessionRepository = ({ inject }: ProviderContext): SessionRepository => {
  const db = inject(DatabaseService);

  const insert = db.query<null, NewSession>(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
     VALUES ($tokenHash, $userId, $expiresAt, $createdAt)`,
  );

  const findActiveUser = db.query<User, { tokenHash: string; now: string }>(
    `SELECT u.id, u.email, u.name, u.balance_cents AS balanceCents, u.created_at AS createdAt
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $tokenHash AND s.expires_at > $now`,
  );

  const remove = db.query<null, { tokenHash: string }>(
    `DELETE FROM sessions WHERE token_hash = $tokenHash`,
  );

  const removeExpired = db.query<null, { now: string }>(
    `DELETE FROM sessions WHERE expires_at <= $now`,
  );

  return {
    create: (session) => void insert.run(session),
    findActiveUser: (tokenHash, now) => findActiveUser.get({ tokenHash, now }),
    delete: (tokenHash) => void remove.run({ tokenHash }),
    deleteExpired: (now) => void removeExpired.run({ now }),
  };
};
