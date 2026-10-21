# Raffle System API

A REST API for a raffle ticket system. Users browse raffles, buy tickets with their account balance, and winners are drawn automatically by a scheduled job.

**Stack:** [Bun](https://bun.sh) · [Elysia](https://elysiajs.com) · [Difunkt](https://www.npmjs.com/package/difunkt) (dependency injection) · TypeScript · SQLite via `bun:sqlite`

- [Quick start](#quick-start)
- [User journey: from seed to winner](#user-journey-from-seed-to-winner)
- [Endpoints](#endpoints)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Design decisions](#design-decisions)
- [Testing](#testing)

## Quick start

Requires Bun 1.3+ (`curl -fsSL https://bun.sh/install | bash`).

```sh
bun install
bun run seed   # creates demo users and raffles in raffle.sqlite
bun run dev    # starts the API on http://localhost:3000 with hot reload
```

| Script | What it does |
|---|---|
| `bun run dev` | Start the API with hot reload |
| `bun start` | Start the API |
| `bun run seed` | Seed demo users and raffles (safe to run more than once) |
| `bun test` | Run the test suite |
| `bun run typecheck` | Type-check with `tsc` |

## User journey: from seed to winner

This walkthrough covers every feature in order: seeding, browsing, logging in, buying tickets (including the error cases), the automatic draw, and checking whether you won. It takes about three minutes, most of which is waiting for the draw.

The commands use `curl` and [`jq`](https://jqlang.org) (preinstalled on recent macOS; otherwise `brew install jq` or `apt install jq`).

### 1. Seed a fresh database

```sh
rm -f raffle.sqlite{,-wal,-shm}   # start clean (optional)
bun run seed
```

```
Seeded raffle.sqlite
  users (password "password123"): alice@example.com, bob@example.com
  raffle 1: Quick draw, draws at 2026-10-19T12:30:00.000Z
  raffle 2: Gaming laptop giveaway, draws at ...
  raffle 3: Summer bike raffle, draws at ...
```

The seed creates:

| User | Password | Starting balance |
|---|---|---|
| `alice@example.com` | `password123` | $100.00 (`10000` cents) |
| `bob@example.com` | `password123` | $3.00 (`300` cents), low on purpose |

It also creates three raffles. **Raffle 1, "Quick draw", draws 2 minutes after seeding** (change this with `SEED_QUICK_DRAW_MINUTES=5 bun run seed`). Do steps 2–6 within those 2 minutes; ticket sales close at the draw time.

> Running `bun run seed` again skips users and raffles that already exist. To get a new quick draw, delete the database and seed again.

### 2. Start the API (terminal 1)

Run the draw job every 5 seconds instead of the default 30, so the draw happens soon after the draw time:

```sh
DRAW_INTERVAL_SECONDS=5 bun run dev
```

Keep this terminal open: the draw job logs the winner here.

### 3. Browse raffles (terminal 2)

```sh
BASE=http://localhost:3000

curl -s $BASE/health
# {"status":"ok"}

# Active raffles (open for ticket sales), soonest draw first
curl -s $BASE/raffles | jq '.[] | {id, title, prize, ticketPriceCents, ticketsRemaining, drawAt}'

# A single raffle
curl -s $BASE/raffles/1 | jq
```

`GET /raffles` returns only **active** raffles by default. Use `?status=drawn` or `?status=all` to see others, and `?limit=` / `?offset=` to page through them.

### 4. Log in as Alice

```sh
ALICE=$(curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' | jq -r .token)

curl -s $BASE/users/me -H "authorization: Bearer $ALICE" | jq
# { "id": 1, "email": "alice@example.com", "name": "Alice", "balanceCents": 10000, ... }
```

> To create your own account instead: `POST /auth/register` with `{"email","name","password"}`. New users start with `INITIAL_BALANCE_CENTS` (default $100.00).

### 5. Buy tickets

Alice buys 3 tickets for the quick draw at $2.00 each:

```sh
curl -s -X POST $BASE/raffles/1/tickets \
  -H "authorization: Bearer $ALICE" -H 'content-type: application/json' \
  -d '{"quantity":3}' | jq
# { "raffleId": 1, "quantity": 3, "totalCents": 600, "tickets": [ { "number": 1, ... }, { "number": 2, ... }, { "number": 3, ... } ] }

curl -s $BASE/users/me -H "authorization: Bearer $ALICE" | jq .balanceCents
# 9400

curl -s $BASE/raffles/1 | jq '{ticketsSold, ticketsRemaining}'
# { "ticketsSold": 3, "ticketsRemaining": 17 }
```

### 6. See the purchase rules in action

Log in as Bob, who has only $3.00:

```sh
BOB=$(curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"bob@example.com","password":"password123"}' | jq -r .token)

# 2 tickets cost $4.00, more than Bob has: rejected, nothing changes
curl -s -X POST $BASE/raffles/1/tickets \
  -H "authorization: Bearer $BOB" -H 'content-type: application/json' \
  -d '{"quantity":2}'
# {"error":"Insufficient balance"}            (HTTP 409)

# More tickets than remain
curl -s -X POST $BASE/raffles/1/tickets \
  -H "authorization: Bearer $BOB" -H 'content-type: application/json' \
  -d '{"quantity":18}'
# {"error":"Only 17 tickets left"}            (HTTP 409)

# Not logged in
curl -s -X POST $BASE/raffles/1/tickets -H 'content-type: application/json' -d '{"quantity":1}'
# {"error":"Missing bearer token"}            (HTTP 401)

# 1 ticket ($2.00) fits Bob's balance, so now there are two players
curl -s -X POST $BASE/raffles/1/tickets \
  -H "authorization: Bearer $BOB" -H 'content-type: application/json' \
  -d '{"quantity":1}' | jq '.tickets[].number'
# 4
```

### 7. Wait for the draw

When raffle 1's draw time passes, the next run of the job draws it. Terminal 1 shows something like:

```
[draw] raffle 1 drawn: ticket #2 (user 1) wins
```

Or wait for it from terminal 2:

```sh
until curl -s $BASE/raffles/1 | jq -e '.status == "drawn"' > /dev/null; do
  echo "waiting for the draw..."; sleep 5
done

curl -s $BASE/raffles/1 | jq '{status, winningNumber, drawnAt}'
# { "status": "drawn", "winningNumber": 2, "drawnAt": "..." }
```

Once the draw time passes, ticket sales stop:

```sh
curl -s -X POST $BASE/raffles/1/tickets \
  -H "authorization: Bearer $ALICE" -H 'content-type: application/json' \
  -d '{"quantity":1}'
# {"error":"Raffle is closed for ticket sales"}   (HTTP 409)
```

### 8. Check your tickets and whether you won

`GET /users/me/tickets` lists your tickets grouped by raffle. `won` is `true` if one of your tickets holds the winning number.

```sh
curl -s $BASE/users/me/tickets -H "authorization: Bearer $ALICE" | jq '.[] | {
  raffle: .raffle.title,
  status: .raffle.status,
  winningNumber: .raffle.winningNumber,
  myNumbers: [.tickets[].number],
  won
}'
# { "raffle": "Quick draw", "status": "drawn", "winningNumber": 2, "myNumbers": [1, 2, 3], "won": true }

curl -s $BASE/users/me/tickets -H "authorization: Bearer $BOB" | jq '.[] | {raffle: .raffle.title, myNumbers: [.tickets[].number], won}'
# { "raffle": "Quick draw", "myNumbers": [4], "won": false }
```

The winning number is random, so in your run Bob may be the winner.

Drawn raffles no longer appear in the default list:

```sh
curl -s $BASE/raffles | jq '[.[].title]'                # Quick draw is gone
curl -s "$BASE/raffles?status=drawn" | jq '[.[].title]' # ["Quick draw"]
```

### 9. Extras

```sh
# Create your own raffle (no admin role yet, so this is public)
curl -s -X POST $BASE/raffles -H 'content-type: application/json' -d "{
  \"title\": \"My raffle\",
  \"prize\": \"Signed poster\",
  \"ticketPriceCents\": 100,
  \"maxTickets\": 10,
  \"drawAt\": \"$(date -u -v+2M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+2 min' +%Y-%m-%dT%H:%M:%SZ)\"
}" | jq

# Log out: the token stops working immediately
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/auth/logout -H "authorization: Bearer $ALICE"   # 204
curl -s $BASE/users/me -H "authorization: Bearer $ALICE"   # {"error":"Invalid or expired token"}
```

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | – | Liveness check |
| `POST` | `/auth/register` | – | Create an account; starts with the configured balance |
| `POST` | `/auth/login` | – | Returns `{ token, expiresAt, user }` |
| `POST` | `/auth/logout` | Bearer | Revokes the current token |
| `GET` | `/users/me` | Bearer | Current user, including `balanceCents` |
| `GET` | `/users/me/tickets` | Bearer | Your tickets grouped by raffle, with `won` |
| `GET` | `/raffles` | – | Active raffles; `?status=active\|drawn\|all`, `?limit=1..100`, `?offset=` |
| `GET` | `/raffles/:id` | – | One raffle |
| `POST` | `/raffles` | – | Create a raffle (`title`, `prize`, `ticketPriceCents`, `maxTickets`, `drawAt`, optional `description`) |
| `POST` | `/raffles/:id/tickets` | Bearer | Buy `{ quantity }` tickets (1–100) |

Authenticated requests send `Authorization: Bearer <token>`. Money is always an integer number of cents.

**Errors** always have the shape `{ "error": "message" }` (validation errors add `details`):

| Status | When |
|---|---|
| `401` | Missing, invalid or expired token; wrong email or password |
| `404` | Raffle or route not found |
| `409` | Raffle closed or sold out, not enough tickets left, insufficient balance, email already registered |
| `422` | Invalid input (schema validation, `drawAt` in the past) |

## Configuration

Set these as environment variables; Bun loads `.env` automatically. See `.env.example`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `raffle.sqlite` | SQLite file (`:memory:` for a throwaway database) |
| `SESSION_TTL_HOURS` | `168` | Login token lifetime |
| `DRAW_INTERVAL_SECONDS` | `30` | How often the draw job runs; `0` disables it |
| `INITIAL_BALANCE_CENTS` | `10000` | Starting balance for new users |
| `SEED_QUICK_DRAW_MINUTES` | `2` | Seed only: minutes until the "Quick draw" raffle draws |

## Architecture

A monolith organised **by feature**. Each feature contains everything it owns and exposes a small public API through its `index.ts`.

```
src/
  core/                     shared plumbing, no business logic
    clock/                  injectable clock (tests control time)
    config/                 environment config
    database/               bun:sqlite connection, migrations, Transaction helper
    http/                   Elysia app, error mapping, AppError classes
    scheduler/              interval scheduler used by the draw job
  features/
    user/                   registration, login sessions, auth plugin, balance
    raffle/                 raffles, ticket reservation, draw status
    ticket/                 purchasing and listing tickets
    draw/                   picking winners + the scheduled job
  app.module.ts             root Difunkt module, composes the Elysia app
  index.ts                  entry point: boot, listen, graceful shutdown
scripts/seed.ts             demo data
test/                       integration and unit tests
```

Every feature follows the same layout:

| File | Role |
|---|---|
| `*.types.ts` | Elysia schemas (request validation and response shape) and the TS types generated from them; repository interfaces |
| `*.providers.ts` | Difunkt tokens for swappable dependencies (repositories, password hasher, random source) |
| `*.repository.ts` | SQLite implementation of the repository interface |
| `*.service.ts` | Business logic; depends on tokens, not on SQLite |
| `*.routes.ts` | Elysia routes, provided through DI |
| `*.module.ts` | Difunkt module that registers the feature's providers |
| `index.ts` | The feature's public API; other features import only from here |

**Dependencies point one way:** `ticket → raffle, user`, `draw → raffle, ticket`. `raffle` and `user` depend on nothing but `core`.

### Dependency injection with Difunkt

Services are factory functions created with `createProvider`, which receive their dependencies through `inject`. Swappable pieces sit behind tokens (`createProviderToken`), for example `RaffleRepositoryToken`, `PasswordHasherToken` and `RandomIntToken`. `createApplication(AppModule, { providers })` lets tests replace any of them: an in-memory database, a fixed clock, a cheap password hasher, a predictable random source.

The draw job starts from a Difunkt **runnable**. Runnables run at boot after all providers are registered, and after migrations because of the module order.

**Why flat modules (`createModule`) and not `createHierarchicalModule`:** we tried Difunkt's hierarchical modules first, for enforced boundaries. In difunkt 0.3.1 they have two problems:

- An exported provider's factory runs in the *importing* module's container, so it can't see the private providers it depends on.
- Each module keeps its own singleton cache, which gave two separate database connections, one for migrations and one for the app.

With flat modules there is a single container. Feature boundaries are kept by convention: import other features only through their `index.ts`.

## Design decisions

**Atomic purchase.** `TicketService.purchase` runs in one `BEGIN IMMEDIATE` transaction:

1. **Reserve seats:** `UPDATE raffles SET tickets_sold = tickets_sold + n WHERE … status = 'open' AND draw_at > now AND tickets_sold + n <= max_tickets`. The check and the increment are a single statement, so two buyers can never both take the last tickets.
2. **Debit the balance:** `UPDATE users SET balance_cents = balance_cents - total WHERE id = ? AND balance_cents >= total`. A database `CHECK (balance_cents >= 0)` backs this up.
3. **Insert the tickets** with sequential numbers taken from the new counter. A unique `(raffle_id, number)` constraint backs this up.

If any step fails, everything rolls back. When a purchase fails, the raffle is re-read so the error states the exact reason (closed, sold out, or only N left).

**Fair, single draw.**

- Ticket numbers are `1..ticketsSold` with no gaps, so the winner is a uniformly random number in that range. It comes from `crypto.randomInt`, which is cryptographically secure.
- The draw records both `winning_number` and `winning_ticket_id`; the ticket links to the winning user.
- Marking a raffle drawn is a guarded `UPDATE … WHERE status = 'open'`, so a raffle can't be drawn twice, even by overlapping runs.
- A raffle with no tickets sold ends `drawn` with `winningNumber: null`.

**Scheduler.** A small `setInterval` wrapper in `core/scheduler`. It runs once at startup, which catches raffles that came due while the server was down, then on every interval. It skips a tick while the previous run is still going, logs errors without stopping, and stops cleanly on shutdown. If one raffle fails to draw, the others are still drawn, and the failed one is retried on the next tick.

**Sessions instead of JWTs.**

- Login returns a random 256-bit token. Only its SHA-256 hash is stored, so a leaked database doesn't leak working tokens.
- Logging out revokes the token immediately.
- Passwords are hashed with argon2id (`Bun.password`).
- A wrong password and an unknown email return the same 401.

**Prices at purchase time.** Each ticket stores the price paid, and money is always an integer number of cents.

**Not in scope:** an admin role (raffle creation is public), payments or top-ups (balances come from seeding or the starting balance), and winner notifications.

## Testing

```sh
bun test
```

The tests boot the full app through Difunkt, with an in-memory SQLite database, a controllable clock and a fast password hasher, and send real HTTP requests through `app.handle()`. They cover:

- validation
- authentication and token expiry
- balance checks and rollback when a purchase fails partway
- sold-out and closed raffles
- the draw: winner recording, draw-once, raffles with no tickets, and failures in one raffle not stopping the others
- the scheduler
- the seed script
