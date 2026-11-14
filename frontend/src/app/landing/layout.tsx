import { VStack } from "@astryxdesign/core/VStack";
import LandingHeader from "./landing-header";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VStack width="100%" hAlign="center">
      <LandingHeader />
      {children}
    </VStack>
  );
}
