import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Server database tables. Changing this file does nothing to the database on its own:
// generate a migration with drizzle-kit and commit it alongside the change.

// Auth tables get their IDs from the server (Postgres's built-in uuidv7()).
// That's fine because they're created on the server and never synced from the phone.
// Synced workout data will use UUIDv7 IDs generated on the device instead (ARCH-02).

// One row per person. Login details live in auth_identities, not here (ARCH-09).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per way of signing in. A user can have several
// (e.g. a password and Sign in with Apple), all pointing at the same user (ARCH-09).
export const authIdentities = pgTable('auth_identities', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  // Deleting a user also deletes their identities (cascade).
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // How they sign in: 'password' for now, later also Apple.
  provider: text('provider').notNull(),
  // Who they are for that provider: the email for 'password', Apple's user ID for Apple.
  providerId: text('provider_id').notNull(),
  email: text('email'),
  // Only set for 'password' identities. Hashed with argon2id, never stored as plain text.
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // The same login can't belong to two accounts. Signing up with an email that's
  // already used breaks this rule, which is how /register detects duplicates.
  uniqueIndex('auth_identities_provider_provider_id_unique').on(table.provider, table.providerId),
  // Speeds up "find all identities for this user".
  index('auth_identities_user_id_idx').on(table.userId),
]);

// Refresh tokens let the phone get new access tokens without logging in again.
// We store only a hash of each token, so a leaked database can't be used to log in.
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Every token created from one login shares a family ID (one family per device).
  // If an old token is ever reused, we can revoke the whole family at once.
  familyId: uuid('family_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // Set when the token is swapped for a new one. Each token works only once.
  usedAt: timestamp('used_at', { withTimezone: true }),
  // Set when the token is cancelled early (sign-out, or a reused token was detected).
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Tokens are looked up by their hash, so this has to be unique and fast to search.
  uniqueIndex('refresh_tokens_token_hash_unique').on(table.tokenHash),
  index('refresh_tokens_family_id_idx').on(table.familyId),
  index('refresh_tokens_user_id_idx').on(table.userId),
]);