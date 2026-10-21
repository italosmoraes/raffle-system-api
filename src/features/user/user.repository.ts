import { SQLiteError } from "bun:sqlite";
import type { ProviderContext } from "difunkt";
import { DatabaseService } from "../../core/database/database.provider";
import type { NewUser, User, UserRepository, UserWithPassword } from "./user.types";

const COLUMNS = `id, email, name, balance_cents AS balanceCents, created_at AS createdAt`;

export const createSqliteUserRepository = ({ inject }: ProviderContext): UserRepository => {
  const db = inject(DatabaseService);

  const findById = db.query<User, { id: number }>(`SELECT ${COLUMNS} FROM users WHERE id = $id`);

  const findByEmail = db.query<UserWithPassword, { email: string }>(
    `SELECT ${COLUMNS}, password_hash AS passwordHash FROM users WHERE email = $email`,
  );

  const insert = db.query<User, NewUser>(
    `INSERT INTO users (email, name, password_hash, balance_cents, created_at)
     VALUES ($email, $name, $passwordHash, $balanceCents, $createdAt)
     RETURNING ${COLUMNS}`,
  );

  const debit = db.query<null, { id: number; amountCents: number }>(
    `UPDATE users SET balance_cents = balance_cents - $amountCents
     WHERE id = $id AND balance_cents >= $amountCents`,
  );

  return {
    findById: (id) => findById.get({ id }),
    findByEmailWithPassword: (email) => findByEmail.get({ email }),
    create: (user) => {
      try {
        return insert.get(user)!;
      } catch (error) {
        if (error instanceof SQLiteError && error.code === "SQLITE_CONSTRAINT_UNIQUE") return null;
        throw error;
      }
    },
    debit: (id, amountCents) => debit.run({ id, amountCents }).changes > 0,
  };
};
