import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users',{
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authIdentities = pgTable('auth_identities',{

    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), 
    provider: text('provider').notNull(),
    providerId: text('provider_id').notNull(),
    email: text('email'),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

}, (table) => [
  uniqueIndex('auth_identities_provider_provider_id_unique').on(table.provider, table.providerId),
  index('auth_identities_user_id_idx').on(table.userId),
]);
    