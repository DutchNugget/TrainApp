import type { FastifyRequest } from 'fastify';

// Route guard: put this in a route's onRequest to require a valid access token.
// jwtVerify() checks the signature and expiry, and fills in request.user.
// On any failure it throws an error carrying status 401, which Fastify sends back.
export async function authenticate(request: FastifyRequest): Promise<void> {
  await request.jwtVerify();
}