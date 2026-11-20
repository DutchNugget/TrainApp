import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';

// Settings for drizzle-kit, the command-line tool that generates and runs migrations.
// It runs outside the server, so it loads the root .env itself (if there is one).
// The path is relative to apps/server/, where drizzle-kit is run from.
if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env in the repo root and fill it in.');
}

export default defineConfig({
  dialect: 'postgresql',
  // drizzle-kit compares this file with the database to work out what changed...
  schema: './src/db/schema.ts',
  // ...and writes the resulting migration SQL files here.
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
});