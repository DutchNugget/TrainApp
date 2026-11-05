import { describe, expect, it } from 'vitest';

import { loginRequestSchema } from '@trainapp/shared';


const validInput = {
  email: 'david@example.com',
  password: 'correct horse battery',
};


describe('loginRequestSchema', () => {
  // ── email ──
  it('trims and lowercases the email', () => {
    const data = loginRequestSchema.parse({
      ...validInput,
      email: '  davID@Example.com ',
    });
    expect(data.email).toBe('david@example.com');
  });

  // ── password: validation ──
  it('rejects an empty password', () => {
    const result = loginRequestSchema.safeParse({
      ...validInput,
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a password shorter than the sign-up minimum', () => {
    const result = loginRequestSchema.safeParse({
      ...validInput,
      password: 'a'.repeat(7),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 129-character password', () => {
    const result = loginRequestSchema.safeParse({
      ...validInput,
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  // ── password: never altered ──
  it('leaves the password unchanged, including surrounding spaces', () => {
    const password = '  Correct Horse Battery  ';
    const data = loginRequestSchema.parse({
      ...validInput,
      password,
    });
    expect(data.password).toBe(password);
  });
});
