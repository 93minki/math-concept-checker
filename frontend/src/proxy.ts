import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function decideRedirect(pathname: string, isLoggedIn: boolean) {
  const isPublic = ["/login", "/signup", "/auth/callback"].includes(pathname);
  if (!isLoggedIn && !isPublic) return "/login";
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup"))
    return "/";
  return null;
}

// Responses may carry a refreshed session cookie; never let a shared cache
// serve them to another user (Supabase SSR guide, "creating-a-client").
const NO_STORE = "private, no-store";

export async function proxy(request: NextRequest) {
  const { response, isLoggedIn } = await updateSession(request);
  const destination = decideRedirect(request.nextUrl.pathname, isLoggedIn);
  if (!destination) {
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  }
  const redirect = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  redirect.headers.set("Cache-Control", NO_STORE);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
