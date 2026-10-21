import { z } from 'zod';

export const registerRequestSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be at most 128 characters"),
    name: z.string().trim().min(1, "Name can't be empty").max(100, "Name must be at most 100 characters").optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;