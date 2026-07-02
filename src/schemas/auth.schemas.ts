import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().trim().optional(),
    username: z.string().trim().optional(),
    password: z.string().min(1, "Senha não fornecida"),
  })
  .refine((data) => Boolean(data.email || data.username), {
    message: "Email não fornecido",
    path: ["email"],
  });

export const resetPasswordSchema = z.object({
  username: z.string().trim().min(1, "Username é obrigatório"),
  newPassword: z
    .string()
    .min(8, "Nova senha deve ter no mínimo 8 caracteres"),
});
