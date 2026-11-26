import { createHash } from 'node:crypto';

import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';

// Apple's public keys: fetched on first use and cached by jose,
// and fetched again automatically when Apple rotates its keys.
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

// Who Apple vouches for: sub is Apple's stable id for this user in our app.
// email may be missing, or a private relay address ("Hide My Email").
export type AppleIdentity = { sub: string; email?: string };

type VerifyOptions = {
  audience: string[]; // which app(s) the token must be meant for (bundle identifiers)
  keys?: JWTVerifyGetKey; // which public keys to trust: Apple's by default, tests pass their own
};

// Checks an Apple identity token: Apple's signature, issuer, audience, expiry and nonce.
// Returns who Apple vouches for, or null if any check fails.
export async function verifyAppleIdentityToken(
  identityToken: string,
  nonce: string,
  { audience, keys = appleKeys }: VerifyOptions,
): Promise<AppleIdentity | null> {
  try {
    const { payload } = await jwtVerify(identityToken, keys, {
      issuer: APPLE_ISSUER,
      audience,
    });

    // The app gave Apple a SHA-256 hash of the nonce, and Apple put that hash in the token.
    // So hash the raw nonce the app sent us, and compare.
    const expectedNonce = createHash('sha256').update(nonce).digest('hex');
    if (typeof payload.sub !== 'string' || payload.nonce !== expectedNonce) {
      return null;
    }

    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch (err) {
    // Couldn't reach Apple's key server in time: our problem, not a bad token.
    // Re-throw so it becomes a 500 and shows up in the logs.
    if (err instanceof errors.JWKSTimeout) {
      throw err;
    }
    // Any other jose error means the token itself failed a check.
    if (err instanceof errors.JOSEError) {
      return null;
    }
    throw err;
  }
}