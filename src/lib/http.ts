import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { assert, DomainError } from "./domain";
export async function readJson(request: Request) {
  assert(request.headers.get("content-type")?.startsWith("application/json"), "JSON is required.", 415);
  const reader = request.body?.getReader();
  assert(reader, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 32_000) { await reader.cancel(); throw new DomainError("Request is too large.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new DomainError("Invalid JSON."); }
}
export function errorResponse(error: unknown) {
  if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  return NextResponse.json({ error: "The studio couldn't finish that action. Your saved work is safe. Check configuration and try again." }, { status: 500 });
}
