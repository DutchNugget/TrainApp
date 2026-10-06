const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to your .env file or your deployment environment, e.g. DATABASE_URL=postgres://user:pass@localhost:5432/mydb")
}

export const env = {
  databaseUrl,
};