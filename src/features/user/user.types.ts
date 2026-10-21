import { type Static, t } from "elysia";

export const UserSchema = t.Object({
  id: t.Integer(),
  email: t.String(),
  name: t.String(),
  balanceCents: t.Integer(),
  createdAt: t.String({ format: "date-time" }),
});

export const RegisterBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  name: t.String({ minLength: 1, maxLength: 100 }),
  // bcrypt-style limit; argon2 has none but long inputs only cost CPU.
  password: t.String({ minLength: 8, maxLength: 72 }),
});

export const LoginBody = t.Object({
  email: t.String({ maxLength: 254 }),
  password: t.String({ maxLength: 72 }),
});

export const LoginResponse = t.Object({
  token: t.String(),
  expiresAt: t.String({ format: "date-time" }),
  user: UserSchema,
});

export type User = Static<typeof UserSchema>;
export type RegisterInput = Static<typeof RegisterBody>;
export type LoginInput = Static<typeof LoginBody>;

export type UserWithPassword = User & { passwordHash: string };

export type NewUser = {
  email: string;
  name: string;
  passwordHash: string;
  balanceCents: number;
  createdAt: string;
};

export type NewSession = {
  tokenHash: string;
  userId: number;
  expiresAt: string;
  createdAt: string;
};

export interface UserRepository {
  findById(id: number): User | null;
  findByEmailWithPassword(email: string): UserWithPassword | null;
  // Returns null when the email is already taken.
  create(user: NewUser): User | null;
  // Atomically subtracts `amountCents` if the balance covers it. Returns false otherwise.
  debit(id: number, amountCents: number): boolean;
}

export interface SessionRepository {
  create(session: NewSession): void;
  findActiveUser(tokenHash: string, now: string): User | null;
  delete(tokenHash: string): void;
  deleteExpired(now: string): void;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}
