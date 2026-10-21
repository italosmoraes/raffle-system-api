import { createModule, provide } from "difunkt";
import { AuthPlugin } from "./auth.plugin";
import { AuthService } from "./auth.service";
import { createSqliteSessionRepository } from "./session.repository";
import {
  bunPasswordHasher,
  PasswordHasherToken,
  SessionRepositoryToken,
  UserRepositoryToken,
} from "./user.providers";
import { createSqliteUserRepository } from "./user.repository";
import { UserRoutes } from "./user.routes";
import { UserService } from "./user.service";

export const UserModule = createModule({
  providers: [
    provide(UserRepositoryToken, { factory: createSqliteUserRepository }),
    provide(SessionRepositoryToken, { factory: createSqliteSessionRepository }),
    provide(PasswordHasherToken, { value: bunPasswordHasher }),
    UserService,
    AuthService,
    AuthPlugin,
    UserRoutes,
  ],
});
