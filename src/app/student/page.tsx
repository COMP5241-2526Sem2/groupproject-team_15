import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, assessment_id, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const latestSubmissionByAssessment = new Map<string, { id: string; assessment_id: string; created_at: string }>();
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
          <ul className="mt-4 space-y-2 text-sm">
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
          <div className="mt-5 space-y-2 text-sm">
            {availableAssessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`/student/assessments/${assessment.id}`}
                className="block rounded-lg border border-[var(--stroke)] p-3 transition hover:opacity-90"
              >
                <p className="font-semibold">{assessment.title}</p>
                <p>{assessment.prompt}</p>
              </Link>
            ))}
            {!availableAssessments.length ? <p>No available assessments right now.</p> : null}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Submitted Assignments</h2>
          <p className="mt-2 text-sm">Assessments you have already submitted.</p>
          <div className="mt-5 space-y-2 text-sm">
            {submittedAssessments.map((submission) => {
              const assessment = assessmentsById.get(submission.assessment_id);

              return (
                <div
                  key={submission.id}
                  className="rounded-lg border border-[var(--stroke)] p-3"
                >
                  <p className="font-semibold">{assessment?.title ?? "Assessment"}</p>
                  <p>{assessment?.prompt ?? "Submitted successfully."}</p>
                </div>
              );
            })}
            {!submittedAssessments.length ? <p>No submitted assignments yet.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
