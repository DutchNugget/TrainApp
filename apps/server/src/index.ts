
import { db } from './db/client.js';
import { env } from './env.js';
// Fastify is a factory function: calling it builds and returns a new server instance.
import Fastify from 'fastify';
// Plugin that limits how many requests a client can make in a time window.
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';

import { authRoutes } from './routes/auth.js';
// Plugin that signs and verifies JWT access tokens (adds app.jwt).
import jwt from '@fastify/jwt';
// Creates the server with built-in logging turned on: every request and every
// error is printed to the terminal, so we don't need our own logging code for that.
// `app` is the handle for the whole server.
const app = Fastify({ logger: true});
// Let routes use Zod schemas (from @trainapp/shared) to check request bodies.
// A body that doesn't match the schema is rejected with 400 before the handler runs.
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
// global: false = no route is limited by default. Each route opts in with
// app.rateLimit({...}) and picks its own limits.
await app.register(rateLimit, { global: false });
// Access tokens expire after 15 minutes, so a stolen one is only useful briefly.
// The phone uses its refresh token to get a new one without logging in again.
await app.register(jwt, {
  secret: env.jwtSecret,
  sign: { expiresIn: '15m' },
});

// All auth routes live under /auth (e.g. POST /auth/login).
app.register(authRoutes, {prefix: '/auth'});

// Log which database we're using, but only the host and database name.
// The full URL contains the password, and logs must never contain secrets.
const dbUrl = new URL(env.databaseUrl);
app.log.info(
  { host: dbUrl.host, database: dbUrl.pathname.slice(1) },
  'database configured')


// Health check: any GET request to /health runs this function.
// Used to check the server is up (e.g. curl http://localhost:3000/health).
// It's async like the real routes, which have to wait for database queries.
app.get('/health', async () => {
    return { status: 'ok'};
})


// Starts the server. If anything fails here, the server exits right away
// instead of running in a broken state.
const start = async () => {
    try {
        // Check the database is reachable before accepting requests,
        // so a wrong DATABASE_URL shows up now and not on the first login.
        await db.execute('select 1')
        app.log.info('database reachable')
        // Opens port 3000 and starts listening for requests.
        // host 0.0.0.0 = accept connections from other devices on the network
        // (the iPhone), not only from this machine.
        await app.listen ({ port : 3000, host: '0.0.0.0'})
    } catch (err) {
        app.log.error(err);
        // Exit code 1 means "failed", so whatever started the server can tell.
        process.exit(1)
    }
};

start ();


