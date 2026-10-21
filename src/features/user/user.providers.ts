import { createProviderToken } from "difunkt";
import type { PasswordHasher, SessionRepository, UserRepository } from "./user.types";

export const UserRepositoryToken = createProviderToken<UserRepository>("UserRepository");

export const SessionRepositoryToken = createProviderToken<SessionRepository>("SessionRepository");

export const PasswordHasherToken = createProviderToken<PasswordHasher>("PasswordHasher");

export const bunPasswordHasher: PasswordHasher = {
  hash: (password) => Bun.password.hash(password),
  verify: (password, hash) => Bun.password.verify(password, hash),
};
