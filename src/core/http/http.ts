import { Elysia } from "elysia";
import { AppError } from "./errors";

export const createHttpApp = () =>
  new Elysia()
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        set.status = error.status;
        return { error: error.message };
      }
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: "Not Found" };
      }
      if (code === "VALIDATION") {
        set.status = 422;
        return { error: "Validation Error", details: error.all };
      }
      console.error(error);
      set.status = 500;
      return { error: "Internal Server Error" };
    })
    .get("/health", () => ({ status: "ok" }));
