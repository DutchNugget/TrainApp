import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';

import {
  type LoginRequest,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from '@trainapp/shared';

import { authenticate } from '../auth/authenticate.js'; // NEW
import { createRefreshToken, rotateRefreshToken } from '../auth/refresh-tokens.js';
import { db } from '../db/client.js';
import { authIdentities, users } from '../db/schema.js';

//helper function
function isDuplicateEmail(err: unknown):boolean {
  const cause = (err as { cause?: {code?: string; constraint?: string } }).cause;
  return cause?.code === '23505' && cause.constraint === "auth_identities_provider_provider_id_unique"
}

// Used when no account matches, so failed logins take the same time
// whether or not the email exists (no timing leak).
const DUMMY_HASH = await argon2.hash('timing-equalizer-not-a-real-password');

//the plugin itself: a function that receives the app and registers routes on it.
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/register',
     {
      //rate limiter active)
      schema: { body: registerRequestSchema },
      onRequest: app.rateLimit({ max: 30, timeWindow: '1 minute' }),
     }, 
     async (request, reply) => {
      // destructuring body 
    const { email, password, name } = request.body;
      //hashing password
    const passwordHash = await argon2.hash(password); 

    try {
      //inserts user and returns userID
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
      //success response 
      return reply.code(201).send({ userId });  
      //error if email is duplicate
    } catch (err) { 
       if (isDuplicateEmail(err)) {
        return reply.code(409).send({ message: "An account with that email already exists."});
       }
       throw err;
    }
  });

  app.post(
  '/login',
  {
    schema: { body: loginRequestSchema },
    preHandler: app.rateLimit({
      max: 10,
      timeWindow: '15 minutes',
      keyGenerator: (request) => (request.body as LoginRequest).email,
      exponentialBackoff: true,
    }),
    }, async (request, reply) => {
      const { email, password } = request.body;

      //  look up the password identity for this email
      const [identity] = await db
        .select({ userId: authIdentities.userId, passwordHash: authIdentities.passwordHash })
        .from(authIdentities)
        .where(and(eq(authIdentities.provider, 'password'), eq(authIdentities.providerId, email)))
        .limit(1);

      //always verify, even with no account, so every attempt takes the same time
      const hashToCheck = identity?.passwordHash ?? DUMMY_HASH;
      const passwordMatches = await argon2.verify(hashToCheck, password);

      //one identical answer for every failure (ARCH-09)
      if (!identity || !passwordMatches) {
        return reply.code(401).send({ message: 'Invalid email or password' });
      }

      // a fresh login starts a new token family (chain) for this device
      const familyId = randomUUID();
      const refreshToken = await createRefreshToken(identity.userId, familyId);
      const accessToken = app.jwt.sign({ sub: identity.userId });

      return reply.code(200).send({ accessToken, refreshToken });
    });

  // exchange a refresh token for a new access token + the next refresh token
  app.post('/refresh', { schema: { body: refreshRequestSchema } }, async (request, reply) => {
    const result = await rotateRefreshToken(request.body.refreshToken);

    if (!result.ok) {
      // Reuse is a security event worth knowing about; the caller still sees a plain 401.
      if (result.reason === 'reused') {
        request.log.warn('refresh token reuse detected; token family revoked');
      }
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }

    const accessToken = app.jwt.sign({ sub: result.userId });
    return reply.code(200).send({ accessToken, refreshToken: result.refreshToken });
  });

  // NEW: who am I? Requires a valid access token.
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
  };