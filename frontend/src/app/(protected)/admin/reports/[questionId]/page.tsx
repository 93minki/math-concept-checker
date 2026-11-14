import AdminQuestionView from "./view";
export default async function Page({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  return <AdminQuestionView id={questionId} />;
}
