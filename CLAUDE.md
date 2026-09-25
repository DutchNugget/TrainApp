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

- Monorepo: npm workspaces (`apps/*`, `packages/*`)
- Mobile: React Native via Expo (SDK 57), Expo Router, TypeScript 6
- Phone database: SQLite via expo-sqlite, with Drizzle ORM
- Server: Node.js 24 + TypeScript 7 + Fastify
- Server database: Postgres (Docker for local development), with Drizzle ORM
- Auth: email + password, and Sign in with Apple (`expo-apple-authentication`); tokens in `expo-secure-store`
- Dev environment: Linux VM (Xubuntu). The iPhone runs the app through Expo Go on the same network.

## Repo layout

- `apps/mobile/` — Expo app (`@trainapp/mobile`)
- `apps/server/` — Fastify API (`@trainapp/server`)
- `packages/shared/` — code both sides must agree on (`@trainapp/shared`): sync payload shapes, and enums such as set types. Consumed as TypeScript source; there is no build step.
- `docs/decision-log.md` — full architecture decisions (ARCH-01 to ARCH-10): the reasoning, the alternatives rejected, and the technical details. Open it whenever a question touches architecture or one of the rules below needs its context. It is a copy; Notion is the master version.
- Root `package.json` holds only the workspace config. There is one `package-lock.json`, at the root.

## Commands

Run from the repo root unless noted.

Install
- `npm install` — installs everything for all workspaces. Only ever install from the root.
- Add a server package: `npm install <pkg> -w @trainapp/server` (add `-D` for tools only needed during development)
- Add a shared package: `npm install <pkg> -w @trainapp/shared`
- Add an app package: `npx expo install <pkg>`, run from `apps/mobile/`. It picks versions that match the Expo SDK.

Server
- `npm run dev -w @trainapp/server` — starts the API with auto-restart (`tsx watch`) on `0.0.0.0:3000`. Health check: `curl http://localhost:3000/health`
- `npm test -w @trainapp/server` — Vitest
- `npm run typecheck -w @trainapp/server`

Mobile
- `npx expo start` from `apps/mobile/`. Add `--clear` after moving files or changing dependencies.
- `npx expo install --check` from `apps/mobile/` — run after any dependency change.
- `npm run typecheck -w @trainapp/mobile`

Not set up yet: Docker, Postgres, migrations. Add their commands here once they exist and work.

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
- Set types are the text values `warmup`, `working`, `drop`, `failure`, defined once as `SET_TYPES` in `@trainapp/shared`. Never hard-code them anywhere else. The rest timer does not start before a drop set. (ARCH-03)
  - Not decided yet: whether failure sets match working sets for "previous" values, and whether they count as working sets in stats. Ask before assuming either.
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

General
- TypeScript `strict` mode everywhere.
- All schema changes go through Drizzle migrations. Never edit a migration that has already been committed; add a new one.
- Never commit secrets, API keys or `.env` files. Ignore rules live in the root `.gitignore`.
- When an architecture decision changes, update both `docs/decision-log.md` and the matching rule above in the same change. Remind David to update the Notion master version too.

Workspace
- Never create a `package-lock.json` inside a workspace folder, and never run `npm install` inside one. (`npx expo install` in `apps/mobile/` is the exception.)
- Never run `npm audit fix --force`. It can break the versions Expo's SDK requires.
- Anything the app and the server must agree on lives in `packages/shared`. Never copy a type or constant between apps.
- Derive types from runtime values (e.g. `SetType` from `SET_TYPES`), so there is one source of truth for both.
- Stored values (database columns, sync payloads) are stable lowercase identifiers such as `warmup`. Display text and translations are a separate mapping in the app.
- `@types/node` must match the installed Node major version (currently 24).
- apps/mobile/.gitignore is managed by Expo CLI. Don't edit it; put ignore rules in the root .gitignore."

TypeScript and modules
- The server and shared use ES modules with `NodeNext` resolution:
  - Relative imports need a `.js` extension, even for `.ts` files (`./db.js` for `db.ts`).
  - No folder imports: write `./routes/index.js`, not `./routes`.
  - Use `import.meta.dirname` instead of `__dirname`.
- `packages/shared/tsconfig.json` mirrors the server's module settings (its strictest consumer). Keep them in sync.
- `tsx` and Vitest do not type-check. Run `typecheck` for both apps before committing.

Server runtime
- The server listens on `0.0.0.0` so the phone can reach it. The VM's network IP can change after restarts, so never hard-code it.

Testing
- Server tests live in `apps/server/src/__tests__/`.
- Test names: `describe` names the thing under test, and `it` completes the sentence with the behavior (e.g. `@trainapp/shared > is importable from the server`). One behavior per test.
- Don't write change-detector tests that fail on intended changes (e.g. asserting the exact number of set types).
- Sync code needs tests for the gym cases: reply lost followed by a retry, edits on two devices, and a delete on one device with an edit on the other.

Git
- One feature branch per task. Never commit directly to `main`.
- Stage files by name and review `git diff` before committing. Each commit contains one change.
- When moving files, commit the move alone, with no content changes, so git records it as a rename.