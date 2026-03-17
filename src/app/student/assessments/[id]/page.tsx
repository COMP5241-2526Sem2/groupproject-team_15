import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signOut, submitanswer } from "@/app/actions";
import AssessmentAiHelper from "@/app/student/assessments/[id]/assessment-ai-helper";
import { createClient } from "@/lib/supabase/server";

function splitAssessmentQuestions(text: string) {
  return text
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

export default async function StudentAssessmentPage({
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

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "student") {
    redirect("/teacher");
  }

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, prompt, reference_material_id")
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

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Assessment</span>
          <h1 className="mt-2 text-3xl font-semibold">{assessment.title}</h1>
          <p className="text-sm">Welcome, {profile.full_name || "Student"}</p>
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
        <h2 className="text-2xl font-semibold">Task</h2>
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

      <section className="glass-card p-6">
        <h2 className="text-2xl font-semibold">Submit Answer</h2>
        <form action={submitanswer} className="mt-4 space-y-3">
          <input type="hidden" name="assessmentId" value={assessment.id} />
          <textarea
            name="answer"
            className="field min-h-28"
            placeholder="Write your answer"
            required
          />
          <button className="btn-primary" type="submit">
            Submit
          </button>
        </form>

        <AssessmentAiHelper assessmentId={assessment.id} />
      </section>
    </main>
  );
}
