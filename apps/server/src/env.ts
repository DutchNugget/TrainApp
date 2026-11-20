// Reads and checks the server's settings once, at startup.
// If something is missing, the server refuses to start with a clear message,
// instead of failing later in a confusing way.
// The rest of the code imports `env` instead of reading process.env directly.
const databaseUrl = process.env.DATABASE_URL?.trim();
const jwtSecret = process.env.JWT_SECRET?.trim();


if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to your .env file or your deployment environment, e.g. DATABASE_URL=postgres://user:pass@localhost:5432/mydb")
}

// Anyone who knows this secret can create valid access tokens for any user,
// so it must be long and random enough that it can't be guessed.
if (!jwtSecret || jwtSecret.length < 32){
  throw new Error('JWT_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -hex 32');
}

// After the checks above, TypeScript knows both values are strings (not undefined).
export const env = {
  databaseUrl,
  jwtSecret,
};


