//Fastify plugin whose routes use Zod schemas.

import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';

import { registerRequestSchema } from '@trainapp/shared';

//the plugin itself: a function that receives the app and registers routes on it.
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/register', { schema: { body: registerRequestSchema } }, async (request) => {
    return { 
        email: request.body.email,
        name: request.body.name,
     }
  
  });
};