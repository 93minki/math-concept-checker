import AuthHeader from "../auth-header";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthHeader />
      {children}
    </>
  );
}
