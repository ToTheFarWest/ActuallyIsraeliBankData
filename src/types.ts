import { z } from 'zod';

export const ActualTransactionSchema = z.object({
  // Required fields
  account: z.string().uuid(), // Enforces UUIDv4 format
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),

  // Optional fields
  imported_id: z.string().optional(),
  amount: z.number().int().optional(), // Enforces integer (milliunits)
  payee_name: z.string().optional(),
});

// Extract the TypeScript type from the schema
export type ActualTransaction = z.infer<typeof ActualTransactionSchema>;