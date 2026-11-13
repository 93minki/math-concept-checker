import { VStack } from "@astryxdesign/core/VStack";
import HomeActions from "./home-actions";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("signup_status")
    .eq("id", claims.sub)
    .maybeSingle();
  if (error) throw new Error("가입 상태를 확인하지 못했어요.");
  if (profile?.signup_status !== "completed") redirect("/signup/complete");
  return (
    <VStack width="100%" hAlign="center">
      <HomeActions />
      {children}
    </VStack>
  );
}
