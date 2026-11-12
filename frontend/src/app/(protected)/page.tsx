import HomeActions from "./home-actions";
import UnitSelection from "./unit-selection";

export default function Home() {
  return (
    <>
      <HomeActions />
      <main className="study-page home-page">
        <UnitSelection />
      </main>
    </>
  );
}
