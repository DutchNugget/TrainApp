    import { z } from 'zod';


    export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

    export const registerRequestSchema = z.object({
        email: emailSchema,
        password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be at most 128 characters"),
        name: z.string().trim().min(1, "Name can't be empty").max(100, "Name must be at most 100 characters").optional(),
    });


    export const loginRequestSchema = z.object({
    email: emailSchema,
    password: z
        .string()
        .min(1, 'Password is required')
        .max(128, 'Password must be at most 128 characters'),
    });

    export type LoginRequest = z.infer<typeof loginRequestSchema>;
    export type RegisterRequest = z.infer<typeof registerRequestSchema>;



