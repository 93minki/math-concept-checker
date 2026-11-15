import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relative Location: behind the Cloudflare tunnel the standalone server sees
// its own bind address (0.0.0.0:3000) in request.url, so an absolute redirect
// sent Kakao logins to https://0.0.0.0:3000 (2026-11-15 deploy). The browser
// resolves a relative Location against the address it actually used
// (RFC 9110 10.2.2).
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo("/signup/complete");
  }
  return redirectTo("/login?error=callback");
}
