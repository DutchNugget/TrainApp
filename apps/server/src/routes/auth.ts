import { randomUUID } from 'node:crypto'; 

import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';

import { type LoginRequest, loginRequestSchema, registerRequestSchema } from '@trainapp/shared';

import { createRefreshToken } from '../auth/refresh-tokens.js'; 
import { db } from '../db/client.js';
import { authIdentities, users } from '../db/schema.js';

// Checks whether a database error means "this email is already registered".
// 23505 is Postgres's code for "unique rule broken". We also check the rule's name,
// so a different unique rule breaking doesn't get reported as a duplicate email.
// Drizzle wraps the Postgres error, so the details are in err.cause.
function isDuplicateEmail(err: unknown):boolean {
  const cause = (err as { cause?: {code?: string; constraint?: string } }).cause;
  return cause?.code === '23505' && cause.constraint === "auth_identities_provider_provider_id_unique"
}

// Used when no account matches, so failed logins take the same time
// whether or not the email exists (no timing leak).
const DUMMY_HASH = await argon2.hash('timing-equalizer-not-a-real-password');

// The plugin itself: a function that receives the app and registers routes on it.
// index.ts registers it with the /auth prefix.
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST /auth/register: create an account with email + password.
  app.post(
    '/register',
     {
      // Zod checks the body before the handler runs. Invalid input gets a 400.
      schema: { body: registerRequestSchema },
      // At most 30 sign-ups per minute from one IP address (the default key).
      // onRequest runs before the body is parsed, which is fine since we only need the IP.
      onRequest: app.rateLimit({ max: 30, timeWindow: '1 minute' }),
     },
     async (request, reply) => {
      // Already checked and cleaned up by the schema (email trimmed and lowercased).
    const { email, password, name } = request.body;
      // argon2id hash. Only the hash is stored, never the password itself.
    const passwordHash = await argon2.hash(password);

    try {
      // Create the user and their password identity in one transaction:
      // either both rows are saved or neither is. Without it, a failure on the
      // second insert would leave a user with no way to log in.
      const userId = await db.transaction(async (tx)=> {
        const [user] = await tx.insert(users).values({ name }).returning({ id: users.id })

        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: "password",
          providerId: email,
          email, 
          passwordHash,
        });

        return user.id;

      });
      // 201 Created: a new account was made.
      return reply.code(201).send({ userId });
    } catch (err) {
       // 409 Conflict: that email is already registered.
       // (Unlike login, sign-up can't hide that an account exists: the insert fails either way.)
       if (isDuplicateEmail(err)) {
        return reply.code(409).send({ message: "An account with that email already exists."});
       }
       // Any other error: rethrow so Fastify logs it and replies 500.
       throw err;
    }
  });

  // POST /auth/login: check email + password, and return tokens.
  app.post(
  '/login',
  {
    schema: { body: loginRequestSchema },
    // At most 10 attempts per 15 minutes for each email, with longer waits after
    // repeated failures. This slows down password guessing on a single account.
    // It's a preHandler (not onRequest) because it needs the parsed, lowercased
    // email from the body, which only exists after validation.
    preHandler: app.rateLimit({
      max: 10,
      timeWindow: '15 minutes',
      keyGenerator: (request) => (request.body as LoginRequest).email,
      exponentialBackoff: true,
    }),
    }, async (request, reply) => {
      const { email, password } = request.body;

      // Look up the password identity for this email. `identity` is undefined if there's none.
      const [identity] = await db
        .select({ userId: authIdentities.userId, passwordHash: authIdentities.passwordHash })
        .from(authIdentities)
        .where(and(eq(authIdentities.provider, 'password'), eq(authIdentities.providerId, email)))
        .limit(1);

      // Always run the (slow) verify, even when there's no account, so every attempt
      // takes the same time. Otherwise a fast reply would reveal "no such email".
      const hashToCheck = identity?.passwordHash ?? DUMMY_HASH;
      const passwordMatches = await argon2.verify(hashToCheck, password);

      // 401 Unauthorized, with the same message whether the email or the password
      // was wrong, so nobody can use login to find out who has an account (ARCH-09).
      if (!identity || !passwordMatches) {
        return reply.code(401).send({ message: 'Invalid email or password' });
      }

      // A fresh login starts a new token family (chain) for this device.
      const familyId = randomUUID();
      // Long-lived (90 days): the phone stores it and uses it to get new access tokens.
      const refreshToken = await createRefreshToken(identity.userId, familyId);
      // Short-lived (15 min): sent with each API request. `sub` (subject) = the user's ID.
      const accessToken = app.jwt.sign({ sub: identity.userId });

      return reply.code(200).send({ accessToken, refreshToken });
    });
  };