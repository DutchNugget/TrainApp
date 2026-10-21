//Fastify plugin whose routes use Zod schemas.

import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
//password hashing function imported
import * as argon2 from 'argon2';

import { registerRequestSchema } from '@trainapp/shared';



import { db } from '../db/client.js';
import { authIdentities, users } from '../db/schema.js';
//helper function

function isDuplicateEmail(err: unknown):boolean {
  const cause = (err as { cause?: {code?: string; constraint?: string } }).cause;
  return cause?.code === '23505' && cause.constraint === "auth_identities_provider_provider_id_unique"
}


//the plugin itself: a function that receives the app and registers routes on it.
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/register', { schema: { body: registerRequestSchema } }, async (request, reply) => {
      // destructuring body 
    const { email, password, name } = request.body;
      //hashing password
    const passwordHash = await argon2.hash(password); 

    try {
      //inserts user and returns userID
      const userId = await db.transaction(async (tx)=> {
        const [user] = await tx.insert(users).values({ name }).returning({ id: users.id })

        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: "password",
          providerId: email,
          email, 
          passwordHash,
        });

        return user.id;

      });
      //success response 
      return reply.code(201).send({ userId });  
      //error if email is duplicate
    } catch (err) { 
       if (isDuplicateEmail(err)) {
        return reply.code(409).send({ message: "An account with that email already exists."});
       }
       throw err;
    }
  });
};