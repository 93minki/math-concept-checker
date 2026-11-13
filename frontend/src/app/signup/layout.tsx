import { VStack } from "@astryxdesign/core/VStack";
import AuthHeader from "../auth-header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VStack width="100%" hAlign="center">
      <AuthHeader />
      {children}
    </VStack>
  );
}
