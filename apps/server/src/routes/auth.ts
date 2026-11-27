import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';

import {
  appleSignInRequestSchema,
  type LoginRequest,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from '@trainapp/shared';

import { verifyAppleIdentityToken } from '../auth/apple.js';
import { authenticate } from '../auth/authenticate.js';
import {
  createRefreshToken,
  generateRefreshToken,
  revokeRefreshTokenFamily,
  rotateRefreshToken,
} from '../auth/refresh-tokens.js';
import { db } from '../db/client.js';
import { authIdentities, refreshTokens, users } from '../db/schema.js';
import { env } from '../env.js';

// Checks whether a database error means "this sign-in identity already exists":
// for password sign-up, a registered email; for Apple, an Apple account already linked.
// 23505 is Postgres's code for "unique rule broken". We also check the rule's name,
// so a different unique rule breaking doesn't get reported as a duplicate identity.
// Drizzle wraps the Postgres error, so the details are in err.cause.
function isDuplicateIdentity(err: unknown):boolean {
  const cause = (err as { cause?: {code?: string; constraint?: string } }).cause;
  return cause?.code === '23505' && cause.constraint === "auth_identities_provider_provider_id_unique"
}

// Finds the user linked to an Apple account, or undefined if there's none yet.
// Used twice by /apple: the normal lookup, and again after losing a race (see below).
async function findAppleUserId(appleSub: string): Promise<string | undefined> {
  const [identity] = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, 'apple'), eq(authIdentities.providerId, appleSub)))
    .limit(1);
  return identity?.userId;
}

// Used when no account matches, so failed logins take the same time
// whether or not the email exists (no timing leak).
const DUMMY_HASH = await argon2.hash('timing-equalizer-not-a-real-password');

// The plugin itself: a function that receives the app and registers routes on it.
// index.ts registers it with the /auth prefix.
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Login hands out tokens through this helper.
  // A fresh sign-in starts a new token family (chain) for this device.
  // Refresh token: long-lived (90 days), the phone stores it to get new access tokens.
  // Access token: short-lived (15 min), sent with each API request. `sub` (subject) = the user's ID.
  const issueTokens = async (userId: string) => {
    const refreshToken = await createRefreshToken(userId, randomUUID());
    const accessToken = app.jwt.sign({ sub: userId });
    return { accessToken, refreshToken };
  };

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
      // User, identity and the first refresh token in one transaction.
      // If any insert fails, none are saved, so a retry starts from a clean slate
      // (no half-created account that would answer 409 "already exists").
      // That's why this doesn't use issueTokens: it would insert outside the transaction.
      const { userId, refreshToken } = await db.transaction(async (tx)=> {
        const [user] = await tx.insert(users).values({ name }).returning({ id: users.id })

        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: "password",
          providerId: email,
          email, 
          passwordHash,
        });

        const firstToken = generateRefreshToken(user.id, randomUUID());
        await tx.insert(refreshTokens).values(firstToken.row);

        return { userId: user.id, refreshToken: firstToken.token };
      });

      // Signing is pure computation (no database), so it can't half-fail after the commit.
      const accessToken = app.jwt.sign({ sub: userId });

      // 201 Created: the account exists, and the new user is signed in straight away.
      return reply.code(201).send({ accessToken, refreshToken });
    } catch (err) {
       // 409 Conflict: that email is already registered.
       // (Unlike login, sign-up can't hide that an account exists: the insert fails either way.)
       if (isDuplicateIdentity(err)) {
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

      return reply.code(200).send(await issueTokens(identity.userId));
    });

  // POST /auth/apple: sign in (or sign up) with Apple.
  // Apple checks who the person is; we check Apple's identity token, then
  // either sign in the linked user or create a new one.
  // Accounts are never matched by email (ARCH-09): an Apple sign-in with the same
  // email as a password account gets its own, separate account.
  app.post(
    '/apple',
    {
      schema: { body: appleSignInRequestSchema },
      // Same per-IP limit as sign-up, since this can create accounts too.
      onRequest: app.rateLimit({ max: 30, timeWindow: '1 minute' }),
    },
    async (request, reply) => {
      const { identityToken, nonce, name } = request.body;

      // Signature (Apple's key), issuer, audience (our app), expiry and nonce.
      const apple = await verifyAppleIdentityToken(identityToken, nonce, {
        audience: env.appleAudiences,
      });
      // 401: the token is forged, expired, meant for another app, or the nonce doesn't
      // match (a replayed token). One message for all, like login.
      if (!apple) {
        return reply.code(401).send({ message: 'Invalid Apple sign-in' });
      }

      // Returning user: this Apple account is already linked, so just sign them in.
      // 200 here and 201 for a new account, so the app can tell the two apart.
      const existingUserId = await findAppleUserId(apple.sub);
      if (existingUserId) {
        return reply.code(200).send(await issueTokens(existingUserId));
      }

      // New user: user, Apple identity and first refresh token in one transaction,
      // exactly like email sign-up. No password hash: Apple did the checking.
      try {
        const { userId, refreshToken } = await db.transaction(async (tx) => {
          const [user] = await tx.insert(users).values({ name }).returning({ id: users.id });

          await tx.insert(authIdentities).values({
            userId: user.id,
            provider: 'apple',
            providerId: apple.sub,
            email: apple.email,
          });

          const firstToken = generateRefreshToken(user.id, randomUUID());
          await tx.insert(refreshTokens).values(firstToken.row);

          return { userId: user.id, refreshToken: firstToken.token };
        });

        const accessToken = app.jwt.sign({ sub: userId });
        return reply.code(201).send({ accessToken, refreshToken });
      } catch (err) {
        // Race: a second request (a double tap, or a retry on bad signal) created this
        // Apple user between our lookup and our insert, so the unique rule blocked us.
        // The account exists now, so look it up again and sign in to it.
        if (isDuplicateIdentity(err)) {
          const racedUserId = await findAppleUserId(apple.sub);
          if (racedUserId) {
            return reply.code(200).send(await issueTokens(racedUserId));
          }
        }
        throw err;
      }
    },
  );

  // POST /auth/refresh: swap a refresh token for a new access token and the next
  // refresh token. The old refresh token stops working (rotation).
  app.post('/refresh', { schema: { body: refreshRequestSchema } }, async (request, reply) => {
    const result = await rotateRefreshToken(request.body.refreshToken);

    if (!result.ok) {
      // Reuse is a security event worth knowing about; the caller still sees a plain 401.
      if (result.reason === 'reused') {
        request.log.warn('refresh token reuse detected; token family revoked');
      }
      // 401: the phone should pause sync and ask the user to log in again.
      // Logging workouts keeps working offline in the meantime (ARCH-09).
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }

    const accessToken = app.jwt.sign({ sub: result.userId });
    return reply.code(200).send({ accessToken, refreshToken: result.refreshToken });
  });

  // GET /auth/me: "who am I?" Requires a valid access token.
  // `authenticate` runs first and replies 401 itself if the token is missing,
  // expired or forged, so inside the handler request.user is always set.
  app.get('/me', { onRequest: authenticate }, async (request, reply) => {
    const [user] = await db
      .select({ id: users.id, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, request.user.sub))
      .limit(1);

    // The token is valid, but the account may have been deleted since it was issued:
    // access tokens can't be cancelled early, so check that the user still exists.
    if (!user) {
      return reply.code(401).send({ message: 'Account no longer exists' });
    }

    return reply.code(200).send(user);
  });

  // POST /auth/logout: sign out this device by revoking its refresh-token family.
  // Always 204 (success, no body), valid token or not, so the response reveals nothing
  // and repeating it is harmless (idempotent).
  // Same body as /refresh ({ refreshToken }), so it reuses that schema.
  app.post('/logout', { schema: { body: refreshRequestSchema } }, async (request, reply) => {
    await revokeRefreshTokenFamily(request.body.refreshToken);
    return reply.code(204).send();
  });
  };