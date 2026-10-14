import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';

if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env in the repo root and fill it in.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
});