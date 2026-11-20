const databaseUrl = process.env.DATABASE_URL?.trim();
const jwtSecret = process.env.JWT_SECRET?.trim();


if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to your .env file or your deployment environment, e.g. DATABASE_URL=postgres://user:pass@localhost:5432/mydb")
}

if (!jwtSecret || jwtSecret.length < 32){
  throw new Error('JWT_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -hex 32');
}

export const env = {
  databaseUrl,
  jwtSecret,
};


