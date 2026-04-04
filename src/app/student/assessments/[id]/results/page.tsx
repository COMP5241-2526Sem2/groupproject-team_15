import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

function splitAssessmentQuestions(text: string | null | undefined) {
  return (text ?? "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^\s*(?:question|q)\s*\d+[\s).:-]*/i, "")
        .replace(/^\s*[-*]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

export default async function StudentAssessmentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "student") {
    redirect("/login");
  }

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, prompt, answer, reference_material_id")
    .eq("id", id)
    .maybeSingle();

  if (!assessment) {
    notFound();
  }

  const { data: material } = assessment.reference_material_id
    ? await supabase
        .from("materials")
        .select("id, title")
        .eq("id", assessment.reference_material_id)
        .maybeSingle()
    : { data: null };

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, answer, mark, created_at")
    .eq("assessment_id", id)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!submission) {
    redirect(`/student/assessments/${id}`);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Submitted Assignment</span>
          <h1 className="mt-2 text-3xl font-semibold">{assessment.title}</h1>
          <p className="text-sm">Submitted on {new Date(submission.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/student" className="btn-secondary">
            Back to Dashboard
          </Link>
          <form action={signOut}>
            <button className="btn-primary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="glass-card space-y-4 p-6">
        <h2 className="text-2xl font-semibold">Prompt</h2>
        {splitAssessmentQuestions(assessment.prompt).length ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {splitAssessmentQuestions(assessment.prompt).map((question, index) => (
              <li key={`${assessment.id}-question-${index}`}>{question}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm">{assessment.prompt}</p>
        )}
        {material ? (
          <p className="text-sm">
            Reference material:{" "}
            <Link className="underline" href={`/materials/${material.id}`}>
              {material.title}
            </Link>
          </p>
        ) : null}
      </section>

      <section className="glass-card space-y-4 p-6 border-l-4 border-blue-500">
        <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-300">Your Answer</h2>
        <div className="rounded-lg bg-[var(--bg-primary)] p-4 text-sm border border-[var(--stroke)] whitespace-pre-wrap">
          {submission.answer || "No answer provided"}
        </div>
      </section>

      <section className="glass-card space-y-4 p-6 border-l-4 border-green-500">
        <h2 className="text-2xl font-semibold text-green-800 dark:text-green-300">Model Answer</h2>
        <div className="rounded-lg bg-[var(--bg-primary)] p-4 text-sm border border-[var(--stroke)] whitespace-pre-wrap">
          {assessment.answer || "No model answer provided by teacher"}
        </div>
      </section>

      {submission.mark ? (
        <section className="glass-card space-y-4 p-6 border-l-4 border-purple-500">
          <h2 className="text-2xl font-semibold text-purple-800 dark:text-purple-300">AI Feedback & Mark</h2>
          <div className="rounded-lg bg-[var(--bg-primary)] p-4 text-sm border border-[var(--stroke)] whitespace-pre-wrap">
            {submission.mark}
          </div>
        </section>
      ) : null}
    </main>
  );
}