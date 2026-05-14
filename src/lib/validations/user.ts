import { z } from "zod";

const UserRoleEnum = z.enum(["SEPARADOR", "LIDER", "ANALISTA", "GESTOR", "ADMIN"]);

export const CreateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z
    .string()
    .email("Email inválido")
    .transform((v) => v.trim().toLowerCase()),
  role: UserRoleEnum,
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export const UpdateUserSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
    email: z
      .string()
      .email("Email inválido")
      .transform((v) => v.trim().toLowerCase())
      .optional(),
    role: UserRoleEnum.optional(),
    active: z.boolean().optional(),
    newPassword: z
      .string()
      .min(8, "Senha deve ter pelo menos 8 caracteres")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.active !== undefined ||
      data.newPassword !== undefined,
    { message: "Pelo menos um campo deve ser informado para atualização" }
  );

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
