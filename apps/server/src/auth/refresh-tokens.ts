import { createHash, randomBytes } from 'node:crypto';

import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';

// 90 days without using the app before signing in again (rotation renews it).
const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

// SHA-256, not argon2: refresh tokens are long and random, so there's nothing
// to guess, and an unsalted hash lets us look tokens up by their hash.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Creates a refresh token, stores only its hash, and returns the real token,
// which exists only in this response and on the phone.
export async function createRefreshToken(userId: string, familyId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
  });

  return token;
}