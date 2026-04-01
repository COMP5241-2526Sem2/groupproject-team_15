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

export default async function TeacherStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
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

  if (!profile || profile.role !== "teacher") {
    redirect("/student");
  }

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", studentId)
    .maybeSingle();

  if (!studentProfile || studentProfile.role !== "student") {
    notFound();
  }

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, prompt")
    .eq("teacher_id", user.id);

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, assessment_id, answer, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  const { data: mcSets } = await supabase
    .from("mc_sets")
    .select("id, title")
    .eq("teacher_id", user.id);

  const { data: mcSubmissions } = await supabase
    .from("mc_submissions")
    .select("id, set_id, is_correct, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  const latestSubmissionByAssessment = new Map<string, any>();
  for (const submission of submissions ?? []) {
    if (!latestSubmissionByAssessment.has(submission.assessment_id)) {
      latestSubmissionByAssessment.set(submission.assessment_id, submission);
    }
  }

  const submittedAssessments = Array.from(latestSubmissionByAssessment.values());
  const assessmentsById = new Map((assessments ?? []).map((a) => [a.id, a]));

  const latestMcSubmissionBySet = new Map<string, any>();
  const mcSubmissionStatsBySet = new Map<string, { total: number; correct: number }>();

  for (const submission of mcSubmissions ?? []) {
    if (!latestMcSubmissionBySet.has(submission.set_id)) {
      latestMcSubmissionBySet.set(submission.set_id, submission);
    }

    const currentStats = mcSubmissionStatsBySet.get(submission.set_id) ?? { total: 0, correct: 0 };
    mcSubmissionStatsBySet.set(submission.set_id, {
      total: currentStats.total + 1,
      correct: currentStats.correct + (submission.is_correct ? 1 : 0),
    });
  }

  const submittedMcSets = Array.from(latestMcSubmissionBySet.values());
  const mcSetsById = new Map((mcSets ?? []).map((set) => [set.id, set]));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Student Overview</span>
          <h1 className="mt-2 text-3xl font-semibold">
            {studentProfile.full_name || "Unknown Student"}
          </h1>
          <p className="text-sm">Reviewing assignments and MC performance.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/teacher" className="btn-secondary">
            Back to Dashboard
          </Link>
          <form action={signOut}>
            <button className="btn-primary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Submitted Assessments</h2>
          <p className="mt-2 text-sm">Long-form or short-answer submissions.</p>

          <div className="mt-5 space-y-4">
            {submittedAssessments.map((submission) => {
              const assessment = assessmentsById.get(submission.assessment_id);

              return (
                <div key={submission.id} className="rounded-lg border border-[var(--stroke)] p-4">
                  <h3 className="font-semibold text-lg">{assessment?.title ?? "Assessment"}</h3>
                  <div className="mt-2 mb-3 space-y-1 text-sm opacity-80">
                    <p className="font-semibold uppercase text-xs">Prompt / Questions</p>
                    {splitAssessmentQuestions(assessment?.prompt).length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {splitAssessmentQuestions(assessment?.prompt).map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{assessment?.prompt ?? "No prompt found."}</p>
                    )}
                  </div>
                  <div className="p-3 bg-[var(--stroke)] rounded-md">
                    <p className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400 mb-1">Student Answer</p>
                    <p className="text-sm whitespace-pre-wrap w-full break-words">
                      {submission.answer}
                    </p>
                  </div>
                </div>
              );
            })}
            {!submittedAssessments.length ? <p className="text-sm">No submissions available.</p> : null}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">MC Sets Overview</h2>
          <p className="mt-2 text-sm">Click any MC set to view detailed results.</p>

          <div className="mt-5 space-y-3">
            {submittedMcSets.map((submission) => {
              const setItem = mcSetsById.get(submission.set_id);
              if (!setItem) return null; // Ensure it belongs to this teacher

              const stats = mcSubmissionStatsBySet.get(submission.set_id) ?? { total: 0, correct: 0 };
              const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

              return (
                <Link
                  key={submission.id}
                  href={`/teacher/students/${studentId}/mc/${submission.set_id}`}
                  className="block rounded-lg border border-[var(--stroke)] p-4 transition hover:bg-[var(--stroke)]"
                >
                  <p className="font-semibold text-lg">{setItem.title}</p>
                  <div className="flex justify-between items-center mt-2 group">
                    <p className="text-sm opacity-80">
                      Score: {stats.correct}/{stats.total} ({percentage}%)
                    </p>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm border-b border-transparent group-hover:border-current">
                      View details &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
            {!submittedMcSets.length ? <p className="text-sm">No MC sets completed.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
