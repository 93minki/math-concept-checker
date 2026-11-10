import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompleteSignup from "./complete-signup";

export default async function CompleteSignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  return <CompleteSignup />;
}
