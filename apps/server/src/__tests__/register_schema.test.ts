import { describe, expect, it } from 'vitest';

import { registerRequestSchema } from '@trainapp/shared';

// A valid sign-up with only the required fields.
// Every test starts from this and changes only the field it's about.
const validInput = {
  email: 'david@example.com',
  password: 'correct horse battery',
};

describe('registerRequestSchema', () => {
  // ── email ──
  it('trims and lowercases the email', () => {
    const data = registerRequestSchema.parse({ ...validInput, email: '  davID@Example.com ' });
    expect(data.email).toBe('david@example.com');
  });

  it('rejects an invalid email', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, email: 'david-no-email' });
    expect(result.success).toBe(false);
  });

  // ── password: boundaries ──
  it('rejects a 7-character password', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, password: 'a'.repeat(7) });
    expect(result.success).toBe(false);
  });

  it('accepts an 8-character password', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, password: 'a'.repeat(8) });
    expect(result.success).toBe(true);
  });

  it('accepts a 128-character password', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, password: 'a'.repeat(128) });
    expect(result.success).toBe(true);
  });

  it('rejects a 129-character password', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, password: 'a'.repeat(129) });
    expect(result.success).toBe(false);
  });

  // ── password: never altered ──
  it('leaves the password unchanged, including surrounding spaces', () => {
    const password = '  Correct Horse Battery  ';
    const data = registerRequestSchema.parse({ ...validInput, password });
    expect(data.password).toBe(password);
  });

  // ── name: optional ──
  it('accepts a sign-up without a name', () => {
    const result = registerRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects a name of only spaces', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, name: '   ' });
    expect(result.success).toBe(false);
  });

  it('trims the name', () => {
    const data = registerRequestSchema.parse({ ...validInput, name: '  David  ' });
    expect(data.name).toBe('David');
  });

  // ── name: boundaries ──
  it('accepts a 100-character name', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, name: 'a'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('rejects a 101-character name', () => {
    const result = registerRequestSchema.safeParse({ ...validInput, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});