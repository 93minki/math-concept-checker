import Landing from "./landing";
import LoginDialog from "./login-dialog";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ login?: string | string[] }>;
}) {
  const { login } = await searchParams;
  return (
    <>
      <Landing />
      {login === "1" && <LoginDialog />}
    </>
  );
}
