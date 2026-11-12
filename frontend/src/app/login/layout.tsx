import AuthHeader from "../auth-header";

export default function AuthLayout({
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
