// Tells TypeScript what TrainApp's access tokens contain.
// Types only: nothing here runs.
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }; // what app.jwt.sign() must be given
    user: { sub: string }; // what request.user holds after jwtVerify()
  }
}