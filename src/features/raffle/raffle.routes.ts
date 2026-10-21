import { createProvider } from "difunkt";
import { Elysia, t } from "elysia";
import { RaffleService } from "./raffle.service";
import { CreateRaffleBody, ListRafflesQuery, RaffleIdParams, RaffleSchema } from "./raffle.types";

export const RaffleRoutes = createProvider(({ inject }) => {
  const raffles = inject(RaffleService);

  return new Elysia({ prefix: "/raffles" })
    .get("/", ({ query }) => raffles.list(query), {
      query: ListRafflesQuery,
      response: t.Array(RaffleSchema),
    })
    .get("/:id", ({ params }) => raffles.get(params.id), {
      params: RaffleIdParams,
      response: RaffleSchema,
    })
    .post("/", ({ body, status }) => status(201, raffles.create(body)), {
      body: CreateRaffleBody,
      response: { 201: RaffleSchema },
    });
});
