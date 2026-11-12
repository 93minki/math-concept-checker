import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function decideRoute(pathname: string, isLoggedIn: boolean) {
  if (pathname === "/landing") return { redirect: "/" };
  if (!isLoggedIn && pathname === "/") return { rewrite: "/landing" };
  const isPublic = ["/login", "/signup", "/auth/callback"].includes(pathname);
  if (!isLoggedIn && !isPublic) return { redirect: "/login" };
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup"))
    return { redirect: "/" };
  return null;
}

// Responses may carry a refreshed session cookie; never let a shared cache
// serve them to another user (Supabase SSR guide, "creating-a-client").
const NO_STORE = "private, no-store";

export async function proxy(request: NextRequest) {
  const { response, isLoggedIn } = await updateSession(request);
  const destination = decideRoute(request.nextUrl.pathname, isLoggedIn);
  if (!destination) {
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  }
  const rewrittenUrl = request.nextUrl.clone();
  if (destination.rewrite) rewrittenUrl.pathname = destination.rewrite;
  const result = destination.redirect
    ? NextResponse.redirect(new URL(destination.redirect, request.url))
    : NextResponse.rewrite(rewrittenUrl, {
        request: { headers: request.headers },
      });
  response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
  result.headers.set("Cache-Control", NO_STORE);
  return result;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
