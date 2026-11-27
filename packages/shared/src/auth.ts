import { z } from 'zod';

// Request shapes for the auth endpoints. They live in shared so the app and the
// server check input with exactly the same rules.

// Trim and lowercase first, then check it's a valid email.
// That way "  David@Example.com" and "david@example.com" are the same account.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

// The display name rule, shared by email sign-up and Apple sign-in.
// Optional: email sign-ups may skip it, and Apple only shares it on the first sign-in.
const nameSchema = z.string().trim().min(1, "Name can't be empty").max(100, 'Name must be at most 100 characters').optional();

export const registerRequestSchema = z.object({
  email: emailSchema,
  // Passwords are never trimmed or changed: spaces are part of the password.
  // The 128 max stops huge inputs from making argon2 hashing slow (a cheap way to overload the server).
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
  name: nameSchema,
});

// Login checks only "not empty" and the max, not the sign-up minimum of 8.
// If the sign-up rules ever get stricter, accounts made under the old rules can still log in.
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
});

// Refresh tokens are 43 characters; 200 is a generous cap against oversized input.
export const refreshRequestSchema = z.object({ refreshToken: z.string().min(1).max(200) });

// Sign in with Apple. The app sends Apple's identity token, the raw nonce
// (the server checks its hash against the token), and the name, which Apple
// only gives the app on the very first sign-in.
// The nonce is a one-time random value: it ties the token to this one sign-in,
// so a token stolen from an earlier sign-in can't be replayed.
// Apple's tokens are around 1,000 characters; 5,000 is a generous cap.
export const appleSignInRequestSchema = z.object({
  identityToken: z.string().min(1).max(5000),
  nonce: z.string().min(1).max(200),
  name: nameSchema,
});

// TypeScript types worked out from the schemas, so the rules are written down only once.
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type AppleSignInRequest = z.infer<typeof appleSignInRequestSchema>;