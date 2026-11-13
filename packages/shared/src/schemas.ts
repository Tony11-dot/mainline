// Request validation for the API. Kept out of the package index so the web bundle never loads zod.
import { z } from 'zod';
import { SPEEDS } from './api';
import { UCI_RE } from './chess';

export const uciSchema = z.string().regex(UCI_RE);
export const fenSchema = z.string().min(10).max(120);
export const speedSchema = z.enum(SPEEDS);
export const langSchema = z.string().regex(/^[a-z]{2}$/);
export const ratingsCsvSchema = z.string().regex(/^[0-9,]*$/);
export const speedsCsvSchema = z.string().regex(/^[a-z,]*$/);

/** "1600,1800" -> [1600,1800]; absent -> undefined. */
export const parseRatingsCsv = (s?: string) => (s ? s.split(',').filter(Boolean).map(Number) : undefined);
export const parseSpeedsCsv = (s?: string) => (s ? s.split(',').filter(Boolean) : undefined);

export const explorerQuerySchema = z.object({
  source: z.enum(['masters', 'lichess']),
  fen: fenSchema,
  ratings: ratingsCsvSchema.optional(),
  speeds: speedsCsvSchema.optional(),
});

export const evalSubmitSchema = z.object({
  fen: fenSchema,
  depth: z.number().int().min(1).max(99),
  lines: z
    .array(
      z.object({
        moves: z.array(uciSchema).min(1).max(40),
        cp: z.number().int().min(-100000).max(100000).optional(),
        mate: z.number().int().min(-200).max(200).optional(),
      }),
    )
    .min(1)
    .max(5),
});
