import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

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

export default async function StudentPage() {
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

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "student") {
    redirect("/teacher");
  }

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, file_url")
    .order("created_at", { ascending: false });

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, prompt")
    .order("created_at", { ascending: false });

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, assessment_id, mark, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const { data: mcSets } = await supabase
    .from("mc_sets")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  const { data: mcSubmissions } = await supabase
    .from("mc_submissions")
    .select("id, set_id, created_at, is_correct")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const latestSubmissionByAssessment = new Map<string, { id: string; assessment_id: string; mark: string | null; created_at: string }>();
  for (const submission of submissions ?? []) {
    if (!latestSubmissionByAssessment.has(submission.assessment_id)) {
      latestSubmissionByAssessment.set(submission.assessment_id, submission);
    }
  }

  const submittedAssessments = Array.from(latestSubmissionByAssessment.values());
  const submittedAssessmentIds = new Set(submittedAssessments.map((submission) => submission.assessment_id));
  const assessmentsById = new Map((assessments ?? []).map((assessment) => [assessment.id, assessment]));
  const availableAssessments = (assessments ?? []).filter(
    (assessment) => !submittedAssessmentIds.has(assessment.id),
  );

  const latestMcSubmissionBySet = new Map<string, { id: string; set_id: string; created_at: string }>();
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
  const submittedMcSetIds = new Set(submittedMcSets.map((submission) => submission.set_id));
  const mcSetsById = new Map((mcSets ?? []).map((setItem) => [setItem.id, setItem]));
  const availableMcSets = (mcSets ?? []).filter((setItem) => !submittedMcSetIds.has(setItem.id));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Student Dashboard</span>
          <h1 className="mt-2 text-3xl font-semibold">
            Welcome, {profile.full_name || "Student"}
          </h1>
          <p className="text-sm">Upload your reasoning first, then unlock guided support.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="btn-secondary">
            Overview
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
          <h2 className="text-2xl font-semibold">Learning Materials</h2>
          <ul className="mt-4 space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
            {(materials ?? []).map((material) => (
              <li key={material.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <p className="font-semibold">{material.title}</p>
                <p>{material.description || "No description"}</p>
                {material.file_url ? (
                  <Link className="underline" href={`/materials/${material.id}`}>
                    Open in material viewer
                  </Link>
                ) : (
                  <span>No file linked</span>
                )}
              </li>
            ))}
            {!materials?.length ? <li>No materials available yet.</li> : null}
          </ul>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Available Assessments</h2>
          <p className="mt-2 text-sm">Click an assessment to open the answer page.</p>
          <div className="mt-5 space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
            {availableAssessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`/student/assessments/${assessment.id}`}
                className="block rounded-lg border border-[var(--stroke)] p-3 transition hover:opacity-90"
              >
                <p className="font-semibold">{assessment.title}</p>
                {splitAssessmentQuestions(assessment.prompt).length ? (
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {splitAssessmentQuestions(assessment.prompt).map((question, index) => (
                      <li key={`${assessment.id}-available-question-${index}`}>{question}</li>
                    ))}
                  </ol>
                ) : (
                  <p>{assessment.prompt}</p>
                )}
              </Link>
            ))}
            {!availableAssessments.length ? <p>No available assessments right now.</p> : null}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Submitted Assignments</h2>
          <p className="mt-2 text-sm">Assessments you have already submitted.</p>
          <div className="mt-5 space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
            {submittedAssessments.map((submission) => {
              const assessment = assessmentsById.get(submission.assessment_id);

              return (
                <Link
                  href={`/student/assessments/${submission.assessment_id}/results`}
                  key={submission.id}
                  className="block rounded-lg border border-[var(--stroke)] p-3 transition hover:opacity-90"
                >
                  <p className="font-semibold">{assessment?.title ?? "Assessment"}</p>
                  {splitAssessmentQuestions(assessment?.prompt).length ? (
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                      {splitAssessmentQuestions(assessment?.prompt).map((question, index) => (
                        <li key={`${submission.id}-submitted-question-${index}`}>{question}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">{assessment?.prompt ?? "Submitted successfully."}</p>
                  )}
                  {submission.mark ? (
                    <div className="mt-3 border-t border-[var(--stroke)] pt-2">
                      <p className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400 mb-1">AI Feedback / Mark</p>
                      <p className="text-sm font-medium">{submission.mark}</p>
                    </div>
                  ) : null}
              
                </Link>
              );
            })}
            {!submittedAssessments.length ? <p>No submitted assignments yet.</p> : null}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Available MC Sets</h2>
          <p className="mt-2 text-sm">Open a set, answer all MC questions, and submit.</p>
          <div className="mt-5 space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
            {availableMcSets.map((setItem) => (
              <Link
                key={setItem.id}
                href={`/student/mc/${setItem.id}`}
                className="block rounded-lg border border-[var(--stroke)] p-3 transition hover:opacity-90"
              >
                <p className="font-semibold">{setItem.title}</p>
              </Link>
            ))}
            {!availableMcSets.length ? <p>No available MC sets right now.</p> : null}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Submitted MC Sets</h2>
          <p className="mt-2 text-sm">MC sets you have already completed.</p>
          <div className="mt-5 space-y-2 text-sm max-h-96 overflow-y-auto pr-2">
            {submittedMcSets.map((submission) => {
              const setItem = mcSetsById.get(submission.set_id);
              const stats = mcSubmissionStatsBySet.get(submission.set_id) ?? { total: 0, correct: 0 };
              const percentage = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;

              return (
                <Link
                  key={submission.id}
                  href={`/student/mc/${submission.set_id}/results`}
                  className="block rounded-lg border border-[var(--stroke)] p-3 transition hover:opacity-90"
                >
                  <p className="font-semibold">{setItem?.title ?? "MC Set"}</p>
                  <p className="text-sm opacity-80">
                    Result: {stats.correct}/{stats.total} ({percentage}%)
                  </p>
                </Link>
              );
            })}
            {!submittedMcSets.length ? <p>No submitted MC sets yet.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
