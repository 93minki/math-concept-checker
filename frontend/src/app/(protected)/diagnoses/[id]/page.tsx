import DiagnosisView from "./diagnosis-view";

export default async function DiagnosisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="study-page">
      <DiagnosisView id={id} />
    </main>
  );
}
