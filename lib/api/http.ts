import { NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { ApiError, toApiError } from "@/lib/api/errors";

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid request body");
  }
  return result.data;
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  const apiError = toApiError(error);
  return fail(apiError.status, apiError.message);
}
