// Request validation for the API. Kept out of the package index so the web bundle never loads zod.
import { z } from 'zod';

export const explorerQuerySchema = z.object({
  source: z.enum(['masters', 'lichess']),
  fen: z.string().min(10).max(120),
  ratings: z.string().regex(/^[0-9,]*$/).optional(),
  speeds: z.string().regex(/^[a-z,]*$/).optional(),
});

export const evalSubmitSchema = z.object({
  fen: z.string().min(10).max(120),
  depth: z.number().int().min(1).max(99),
  lines: z
    .array(
      z.object({
        moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(1).max(40),
        cp: z.number().int().min(-100000).max(100000).optional(),
        mate: z.number().int().min(-200).max(200).optional(),
      }),
    )
    .min(1)
    .max(5),
});
