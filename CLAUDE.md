# TrainApp

Offline-first iPhone app for logging strength workouts (exercises, sets, reps, weight) and viewing progress.
MVP = exercise module only. Bodyweight, food and goals come later as separate modules.
Primary use: mid-workout in a gym with poor signal. Logging must never depend on a connection.

## How to work with David (read first)

- **Guide and explain; don't write code unless asked.** Default to explaining the approach, which files and functions are involved, and the steps to take. David writes the code.
- **Only create or edit source files when David explicitly asks** (e.g. "write it", "show me the code", "make the change"). When you do, keep the change small and explain it line by line where it isn't obvious.
- Short snippets inside an explanation are fine only to illustrate a concept or syntax, not to hand over the solution.
- **This is David's first project with a backend.** Explain backend concepts (transactions, migrations, auth, sync, HTTP status codes, etc.) in plain language, with the *why*, not just the *what*.
- **Two modes; David will say which.** In learning mode, focus on concepts and reasoning. In implementation mode, give concrete step-by-step guidance. Code still only on request.
- **Reviewing David's code:** point out bugs and risks honestly and explain why. Give a hint first; give the full fix if he asks or is stuck.
- **Work in small steps.** Suggest the next step rather than planning ten ahead.
- **Ask before anything large:** new dependencies, schema changes, restructuring folders, or changing an architecture rule below.
- **If a request conflicts with an architecture rule, say so** and name the decision (e.g. "this breaks ARCH-05"), instead of silently complying or silently refusing.
- Reading files, searching the code, and running tests or linters is fine without asking.

## Stack

- Mobile: React Native via Expo, Expo Router, TypeScript
- Phone database: SQLite via expo-sqlite, with Drizzle ORM
- Server: Node.js + TypeScript + Fastify
- Server database: Postgres (Docker for local development), with Drizzle ORM
- Auth: email + password, and Sign in with Apple (`expo-apple-authentication`); tokens in `expo-secure-store`
- Dev environment: Linux VM

## Repo layout (proposed — update when created)

- `apps/mobile/` — Expo app
- `apps/server/` — Fastify API
- `packages/shared/` — TypeScript types shared by both sides (sync payloads, enums such as set types)
- `docs/decision-log.md` — full architecture decisions (ARCH-01 to ARCH-10): the reasoning, the alternatives rejected, and the technical details. Open it whenever a question touches architecture or one of the rules below needs its context. It is a copy; Notion is the master version.

## Commands

<!-- Add each command once it actually exists and works. -->

## Architecture rules (do not break without discussing first)

Offline-first
- The UI only reads and writes the phone database. No screen or logging action waits on the network. (ARCH-05)
- Sync runs in the background: on app open, when signal returns, and when a workout is finished.

Data
- IDs are UUIDv7, generated on the device. Never use auto-increment IDs for synced data. (ARCH-02)
- No hard deletes. Set `deleted_at` instead. (ARCH-02)
- Every synced table has `user_id` and is registered in the synced-table list, in dependency order: exercise definitions → workout sessions → session exercises → sets. (ARCH-05)
- Derived values (progress, PRs, volume, previous weight) are computed when read, never stored. (ARCH-02)
- Weight is stored as the value entered plus its unit. No conversion on save. (ARCH-02)
- Time: exact moments are UTC timestamps plus the user's time zone. Day-based entries store an explicit local date. (ARCH-02)

Domain
- Starting a workout from a routine **copies** the routine's exercises and sets into new session rows. Sessions never reference routine rows for their data. (ARCH-01)
- Set types are the text values `warmup`, `working`, `drop`. The rest timer does not start before a drop set. (ARCH-03)
- The rest timer stores an absolute end time and schedules a local notification. Never rely on a JS countdown. (ARCH-03)
- "Previous" values come from the last session containing the same exercise (any routine), matched by position within the same set type. Fall back to routine targets. (ARCH-03)
- Exercise definitions have `source` = `builtin` or `custom`. Built-ins ship with the app and are not synced. Deleting a custom exercise **archives** it and never removes sets. (ARCH-10)

Sync (ARCH-05, ARCH-06)
- Pull, then push. The server issues the cursor. Never use the phone's clock as a sync cursor.
- Every push write is an upsert by client UUID, so retries are always safe.
- The server locks the user's row in each push transaction. One push is applied in one transaction.
- The client sends `schemaVersion` and ignores unknown tables.
- Conflicts: row-level last-write-wins by server arrival order. Deletes cascade to children, except for exercise definitions (archive).

Modules (ARCH-04)
- Each module owns its own tables and folder. Modules may read other modules' data, one direction only, and never write to them.
- Each module exports a descriptor (id, title, icon, route). The tab bar is built from the enabled descriptors. Settings is not a module and is always shown.

Auth (ARCH-09)
- One `User` has many `AuthIdentity` rows. Never merge accounts automatically by email.
- Auth never blocks logging. An expired token only pauses sync.
- Never delete unsynced local data: not on sign-out, not on auth failure.
- Passwords are hashed with argon2id. Login errors look the same whether or not the account exists.

## Conventions

- TypeScript `strict` mode everywhere.
- All schema changes go through Drizzle migrations. Never edit a migration that has already been committed; add a new one.
- Sync code needs tests for the gym cases: reply lost followed by a retry, edits on two devices, and a delete on one device with an edit on the other.
- Never commit secrets, API keys or `.env` files.
- When an architecture decision changes, update both `docs/decision-log.md` and the matching rule below in the same change. Remind David to update the Notion master version too.

## Git workflow

<!-- Paste the short version from the Claude Setup & Workflow page in Notion. -->
