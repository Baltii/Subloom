import { z } from "zod";
import { readableError } from "../../store/app";
export function financeError(error: unknown) {
  return error instanceof z.ZodError
    ? (error.issues[0]?.message ?? "Check your financial details.")
    : readableError(error);
}
