import { createProvider } from "difunkt";
import { Elysia } from "elysia";
import { UnauthorizedError } from "../../core/http/errors";
import { AuthService } from "./auth.service";

// Adds an `auth: true` route option that requires a bearer token and
// exposes `user` and `sessionToken` to the handler.
export const AuthPlugin = createProvider(({ inject }) => {
  const auth = inject(AuthService);

  return new Elysia({ name: "auth" }).macro({
    auth: {
      resolve({ headers }) {
        const [scheme, token] = headers.authorization?.split(" ") ?? [];
        if (scheme?.toLowerCase() !== "bearer" || !token) {
          throw new UnauthorizedError("Missing bearer token");
        }
        return { user: auth.authenticate(token), sessionToken: token };
      },
    },
  });
});
