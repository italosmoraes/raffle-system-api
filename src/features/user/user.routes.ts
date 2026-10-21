import { createProvider } from "difunkt";
import { Elysia } from "elysia";
import { AuthPlugin } from "./auth.plugin";
import { AuthService } from "./auth.service";
import { UserService } from "./user.service";
import { LoginBody, LoginResponse, RegisterBody, UserSchema } from "./user.types";

export const UserRoutes = createProvider(({ inject }) => {
  const users = inject(UserService);
  const auth = inject(AuthService);

  return new Elysia()
    .use(inject(AuthPlugin))
    .post("/auth/register", async ({ body, status }) => status(201, await users.register(body)), {
      body: RegisterBody,
      response: { 201: UserSchema },
    })
    .post("/auth/login", ({ body }) => auth.login(body), {
      body: LoginBody,
      response: LoginResponse,
    })
    .post(
      "/auth/logout",
      ({ sessionToken, status }) => {
        auth.logout(sessionToken);
        return status(204);
      },
      { auth: true },
    )
    .get("/users/me", ({ user }) => user, {
      auth: true,
      response: UserSchema,
    });
});
