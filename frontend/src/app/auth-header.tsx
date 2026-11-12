import Link from "next/link";

export default function AuthHeader() {
  return (
    <header className="home-header">
      <div className="home-header-inner">
        <Link className="home-brand" href="/">
          수학 개념 체커
        </Link>
      </div>
    </header>
  );
}
