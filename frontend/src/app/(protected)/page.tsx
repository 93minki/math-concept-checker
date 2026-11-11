import HomeActions from "./home-actions";
import UnitSelection from "./unit-selection";

export default function Home() {
  return (
    <main className="study-page">
      <h1>수학 개념 체커</h1>
      <HomeActions />
      <UnitSelection />
    </main>
  );
}
