import { createHash } from 'node:crypto';

import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { verifyAppleIdentityToken } from '../auth/apple.js';

const AUDIENCE = 'com.example.trainapp';
const NONCE = 'test-nonce-123';

// Two key pairs: one plays "Apple", the other an attacker trying to forge tokens.
const apple = await generateKeyPair('RS256');
const attacker = await generateKeyPair('RS256');

// The keys the function will trust in these tests: only "Apple's" public key.
const publicJwk = await exportJWK(apple.publicKey);
const keys = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256' }] });

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Builds an Apple-style identity token. Each test changes only what it's about.
async function makeToken({
  signedBy = 'apple',
  issuer = 'https://appleid.apple.com',
  audience = AUDIENCE,
  expiresAt = '5m',
  claims = {},
}: {
  signedBy?: 'apple' | 'attacker';
  issuer?: string;
  audience?: string;
  expiresAt?: string | number;
  claims?: JWTPayload;
} = {}) {
  const privateKey = signedBy === 'apple' ? apple.privateKey : attacker.privateKey;

  return new SignJWT({ nonce: sha256(NONCE), email: 'anna@privaterelay.appleid.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('001234.apple-user-id')
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

const verify = (token: string, nonce = NONCE) =>
  verifyAppleIdentityToken(token, nonce, { audience: [AUDIENCE], keys });

describe('verifyAppleIdentityToken', () => {
  it('accepts a valid token and returns who Apple vouches for', async () => {
    const result = await verify(await makeToken());
    expect(result).toEqual({ sub: '001234.apple-user-id', email: 'anna@privaterelay.appleid.com' });
  });

  it('works when Apple sends no email', async () => {
    const result = await verify(await makeToken({ claims: { email: undefined } }));
    expect(result).toEqual({ sub: '001234.apple-user-id', email: undefined });
  });

  it('rejects a token signed by someone other than Apple', async () => {
    expect(await verify(await makeToken({ signedBy: 'attacker' }))).toBeNull();
  });

  it('rejects a token meant for another app', async () => {
    expect(await verify(await makeToken({ audience: 'com.someone.elses.app' }))).toBeNull();
  });

  it('rejects a token from another issuer', async () => {
    expect(await verify(await makeToken({ issuer: 'https://evil.example.com' }))).toBeNull();
  });

  it('rejects an expired token', async () => {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    expect(await verify(await makeToken({ expiresAt: oneMinuteAgo }))).toBeNull();
  });

  it('rejects a token whose nonce does not match', async () => {
    expect(await verify(await makeToken(), 'a-different-nonce')).toBeNull();
  });
}); 