import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut, submitThinking } from "@/app/actions";
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
    .select("id, title, prompt, rubric")
    .order("created_at", { ascending: false });

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, attempt_no, thinking_process, ai_feedback, partial_score, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

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
                <a className="underline" href={material.file_url || "#"}>
                  {material.file_url ? "Open material" : "No file linked"}
                </a>
              </li>
            ))}
            {!materials?.length ? <li>No materials available yet.</li> : null}
          </ul>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Submit Thinking Process</h2>
          <p className="mt-2 text-sm">
            Required before hints and partial solutions are shown.
          </p>
          <form action={submitThinking} className="mt-4 space-y-3">
            <select name="assessmentId" className="field" required>
              <option value="">Select an assessment</option>
              {(assessments ?? []).map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title}
                </option>
              ))}
            </select>
            <textarea
              name="thinkingProcess"
              className="field min-h-28"
              placeholder="Write steps, assumptions, or upload summary from OCR output"
              required
            />
            <button className="btn-primary" type="submit">
              Get Socratic Feedback
            </button>
          </form>

          <div className="mt-5 space-y-2 text-sm">
            <h3 className="text-lg font-semibold">Available Assessments</h3>
            {(assessments ?? []).map((assessment) => (
              <article key={assessment.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <p className="font-semibold">{assessment.title}</p>
                <p>{assessment.prompt}</p>
                <p className="text-xs opacity-75">Rubric: {assessment.rubric || "Not set"}</p>
              </article>
            ))}
            {!assessments?.length ? <p>No assessments published yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-2xl font-semibold">My Attempt History</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {(submissions ?? []).map((submission) => (
            <li key={submission.id} className="rounded-lg border border-[var(--stroke)] p-3 text-sm">
              <span className="chip">Attempt {submission.attempt_no}</span>
              <p className="mt-2">{submission.thinking_process}</p>
              <p className="mt-2 font-semibold">AI Prompt:</p>
              <p>{submission.ai_feedback || "Pending"}</p>
              <p className="mt-2">Partial score: {submission.partial_score ?? 0}</p>
            </li>
          ))}
          {!submissions?.length ? <li>No attempts yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
