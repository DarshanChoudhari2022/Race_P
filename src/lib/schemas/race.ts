import { z } from "zod";

export const runnerSchema = z.object({
  horseNumber: z.coerce.number().int().positive(),
  drawNumber: z.coerce.number().int().positive().nullable(),
  horseName: z.string().min(1),
  trainer: z.string().min(1),
  jockey: z.string().min(1),
  numberFontSize: z.number().optional(),
  horseFontSize: z.number().optional(),
  trainerFontSize: z.number().optional(),
  jockeyFontSize: z.number().optional(),
  drawFontSize: z.number().optional(),
  confidence: z.enum(["high", "medium", "needs_review"]).optional(),
  warnings: z.array(z.string()).optional(),
});

export const raceSchema = z.object({
  date: z.string().regex(/^\d{2}-\d{2}-\d{4}$/),
  venue: z.string().min(1),
  raceNumber: z.coerce.number().int().positive(),
  time: z.string().min(1),
  distanceMetres: z.coerce.number().int().positive(),
  runners: z.array(runnerSchema),
  confidence: z.enum(["high", "medium", "needs_review"]).optional(),
  warnings: z.array(z.string()).optional(),
});

export const racesSchema = z.array(raceSchema);
