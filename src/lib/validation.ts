import { z } from "zod";

export const pillarKey = z.enum(["F", "O", "R", "G", "E"]);
export const score = z.coerce.number().int().min(1).max(5);
export const text = (max = 4000) => z.string().trim().max(max).default("");
export const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    obj[k] = typeof v === "string" ? v : undefined;
  }
  return schema.parse(obj);
}
