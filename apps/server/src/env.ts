// Reads and checks the server's settings once, at startup.
// If something is missing, the server refuses to start with a clear message,
// instead of failing later in a confusing way.
// The rest of the code imports `env` instead of reading process.env directly.
const databaseUrl = process.env.DATABASE_URL?.trim();
const jwtSecret = process.env.JWT_SECRET?.trim();

// Which apps an Apple identity token may be meant for (its `aud` claim).
// Checking it stops a token that Apple issued for some other app from logging in here.
// Comma-separated, e.g. "host.exp.Exponent" while testing in Expo Go,
// and only the real bundle identifier in production.
const appleAudiences = (process.env.APPLE_AUDIENCES ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);


if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to your .env file or your deployment environment, e.g. DATABASE_URL=postgres://user:pass@localhost:5432/mydb")
}

// Anyone who knows this secret can create valid access tokens for any user,
// so it must be long and random enough that it can't be guessed.
if (!jwtSecret || jwtSecret.length < 32){
  throw new Error('JWT_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -hex 32');
}

// Without at least one audience, no Apple sign-in could ever be verified.
if (appleAudiences.length === 0) {
  throw new Error('APPLE_AUDIENCES is not set. Use APPLE_AUDIENCES=host.exp.Exponent while testing in Expo Go, or your app\'s bundle identifier in production.');
}

// After the checks above, TypeScript knows databaseUrl and jwtSecret are strings
// (not undefined). appleAudiences is always a list, and the check above makes sure it isn't empty.
export const env = {
  databaseUrl,
  jwtSecret,
  appleAudiences,
};