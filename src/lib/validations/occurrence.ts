import { z } from "zod";

export const OccurrenceItemSchema = z.object({
  productId: z.string().min(1, "Produto obrigatório"),
  barcodeInput: z.string().optional(),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  unitValue: z.number().min(0, "Valor unitário inválido"),
  totalValue: z.number(),
  batch: z.string().optional(),
  expirationDate: z.string().optional(),
  damageTypeId: z.string().min(1, "Tipo de avaria obrigatório"),
});

export const CreateOccurrenceSchema = z.object({
  originId: z.string().min(1, "Origem obrigatória"),
  description: z.string().min(1, "Descrição obrigatória"),
  notes: z.string().optional(),
  items: z.array(OccurrenceItemSchema).min(1, "Pelo menos um produto"),
});

export const UpdateOccurrenceSchema = z.object({
  statusId: z.string().optional(),
  destinationId: z.string().optional().nullable(),
  description: z.string().optional(),
  destinationObservation: z.string().optional().nullable(),
  storageLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  originId: z.string().optional(),
});

export type CreateOccurrenceInput = z.infer<typeof CreateOccurrenceSchema>;
export type UpdateOccurrenceInput = z.infer<typeof UpdateOccurrenceSchema>;
export type OccurrenceItemInput = z.infer<typeof OccurrenceItemSchema>;
