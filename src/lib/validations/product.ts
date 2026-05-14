import { z } from "zod";

export const CreateProductSchema = z.object({
  ean: z.string().min(1, "EAN obrigatório"),
  dun: z.string().optional(),
  internalCode: z.string().min(1, "Código interno obrigatório"),
  description: z.string().min(1, "Descrição obrigatória"),
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  active: z.boolean().optional(),
});

export const CreatePriceSchema = z.object({
  productId: z.string().min(1, "Produto obrigatório"),
  unitValue: z.number().positive("Valor deve ser maior que zero"),
  validFrom: z.string().min(1, "Data de início obrigatória"),
  validTo: z.string().optional(),
  sourceNote: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreatePriceInput = z.infer<typeof CreatePriceSchema>;
