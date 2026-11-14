import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompleteSignup from "./complete-signup";

export default async function CompleteSignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  // Every Kakao sign-in lands here (/auth/callback). Users who already
  // finished signup go home, so consent is asked only on a real signup.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("signup_status")
    .eq("id", claims.sub)
    .maybeSingle();
  if (error) throw new Error("가입 상태를 확인하지 못했어요.");
  if (profile?.signup_status === "completed") redirect("/");
  return <CompleteSignup />;
}
