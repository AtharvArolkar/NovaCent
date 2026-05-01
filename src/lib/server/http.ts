import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function problem(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return problem("Invalid request payload", 422, error.flatten());
  }

  if (error instanceof Error) {
    if (error.message.includes("Unauthorized")) {
      return problem(error.message, 401);
    }

    if (error.message.includes("Forbidden")) {
      return problem(error.message, 403);
    }

    return problem(error.message, 500);
  }

  return problem("Unexpected server error", 500);
}

export async function readJson<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  return schema.parse(await request.json());
}

export function fail(error: unknown) {
  return handleApiError(error);
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function queryParam(url: string, key: string): string | null {
  return new URL(url).searchParams.get(key);
}
