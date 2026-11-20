import { createHash, randomBytes } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';

// 90 days without using the app before signing in again (rotation renews it).
const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

// SHA-256, not argon2: refresh tokens are long and random, so there's nothing
// to guess, and an unsalted hash lets us look tokens up by their hash.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Makes a new random token plus the database row describing it.
// The row holds only the hash; the real token goes back to the phone.
function generateRefreshToken(userId: string, familyId: string) {
  const token = randomBytes(32).toString('base64url');
  const row = {
    userId,
    familyId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
  };
  return { token, row };
}

// Login: start a new family with its first token.
export async function createRefreshToken(userId: string, familyId: string): Promise<string> {
  const { token, row } = generateRefreshToken(userId, familyId);
  await db.insert(refreshTokens).values(row);
  return token;
}

// Either success (with the new token) or a failure reason. Checking `ok` first
// lets TypeScript know which of the two shapes you have.
// 'invalid' = unknown, revoked or expired. 'reused' = already used once (possible theft).
type RotateResult =
  | { ok: true; userId: string; refreshToken: string }
  | { ok: false; reason: 'invalid' | 'reused' };

// Refresh: exchange a valid, unused token for the next one in its family.
// Returns a result instead of throwing, so the transaction always commits
// (a reuse revocation must be saved, not rolled back).
export async function rotateRefreshToken(token: string): Promise<RotateResult> {
  return db.transaction(async (tx) => {
    // Lock the row so two simultaneous refreshes of the same token take turns.
    const [current] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(token)))
      .for('update');

    // Unknown token, or one that was cancelled (sign-out or an earlier reuse).
    if (!current || current.revokedAt) {
      return { ok: false, reason: 'invalid' } as const;
    }

    // Already used: someone is replaying it. We can't tell whether the thief or the
    // real phone is asking, so revoke the whole chain and force a fresh login.
    if (current.usedAt) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, current.familyId), isNull(refreshTokens.revokedAt)));
      return { ok: false, reason: 'reused' } as const;
    }

    if (current.expiresAt < new Date()) {
      return { ok: false, reason: 'invalid' } as const;
    }

    // Valid: mark this one used, and issue the next token in the same family.
    await tx.update(refreshTokens).set({ usedAt: new Date() }).where(eq(refreshTokens.id, current.id));

    const next = generateRefreshToken(current.userId, current.familyId);
    await tx.insert(refreshTokens).values(next.row);

    return { ok: true, userId: current.userId, refreshToken: next.token } as const;
  });
}