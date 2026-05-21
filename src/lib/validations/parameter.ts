import { z } from "zod";

export const CreateOriginSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(80, "Nome deve ter no máximo 80 caracteres")
    .transform((v) => v.trim()),
});

export const UpdateOriginSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres")
      .max(80, "Nome deve ter no máximo 80 caracteres")
      .transform((v) => v.trim())
      .optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.active !== undefined,
    { message: "Pelo menos um campo deve ser informado para atualização" }
  );

export type CreateOriginInput = z.infer<typeof CreateOriginSchema>;
export type UpdateOriginInput = z.infer<typeof UpdateOriginSchema>;
