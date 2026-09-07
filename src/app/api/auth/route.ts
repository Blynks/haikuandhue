import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken, login, SESSION_COOKIE, sessionCookieOptions, verifyOrigin } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";

export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const input = z.object({ action: z.enum(["login", "logout"]), email: z.string().max(254).optional(), password: z.string().max(200).optional() }).parse(await readJson(request));
    if (input.action === "logout") {
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
      (await cookies()).delete(SESSION_COOKIE);
    } else {
      const token = await login(input.email ?? "", input.password ?? "");
      (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
