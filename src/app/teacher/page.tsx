import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createMaterial,
  deleteAssessment,
  deleteMcSet,
  deleteMaterial,
  signOut,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import DeleteIconButton from "@/app/teacher/delete-icon-button";

function splitAssessmentLines(text: string | null) {
  return (text ?? "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^\s*(?:question|answer|q|a)\s*\d+[\s).:-]*/i, "")
        .replace(/^\s*[-*]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

export default async function TeacherPage() {
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

  if (profile.role !== "teacher") {
    redirect("/student");
  }

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, file_url, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, prompt, answer, reference_material_id, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const { data: mcSets } = await supabase
    .from("mc_sets")
    .select("id, title, reference_material_id, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const { data: mcQuestions } = await supabase
    .from("mc_questions")
    .select("id, set_id, question")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student")
    .order("full_name", { ascending: true });

  const materialTitleById = new Map((materials ?? []).map((material) => [material.id, material.title]));
  const mcQuestionCountBySetId = new Map<string, number>();
  const firstMcQuestionBySetId = new Map<string, string>();

  (mcQuestions ?? []).forEach((question) => {
    if (!question.set_id) return;

    mcQuestionCountBySetId.set(
      question.set_id,
      (mcQuestionCountBySetId.get(question.set_id) ?? 0) + 1,
    );

    if (!firstMcQuestionBySetId.has(question.set_id)) {
      firstMcQuestionBySetId.set(question.set_id, question.question);
    }
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Teacher Dashboard</span>
          <h1 className="mt-2 text-3xl font-semibold">
            Welcome, {profile.full_name || "Teacher"}
          </h1>
          <p className="text-sm">Manage learning materials and adaptive assessments.</p>
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
          <h2 className="text-2xl font-semibold">Upload Study Material</h2>
          <form action={createMaterial} className="mt-4 space-y-3">
            <input name="title" className="field" placeholder="Material title" required />
            <textarea
              name="description"
              className="field min-h-24"
              placeholder="Short description"
            />
            <input
              name="file"
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg"
              className="field"
            />
            <button className="btn-primary" type="submit">
              Save Material
            </button>
          </form>

          <ul className="mt-5 space-y-2 text-sm">
            {(materials ?? []).map((material) => (
              <li key={material.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{material.title}</p>
                  <DeleteIconButton
                    action={deleteMaterial}
                    fieldName="materialId"
                    fieldValue={material.id}
                    ariaLabel={`Delete material ${material.title}`}
                    title="Delete material"
                    confirmMessage="Are you sure you want to delete this material?"
                  />
                </div>
                <p>{material.description || "No description"}</p>
                {material.file_url ? (
                  <Link className="underline" href={`/materials/${material.id}`}>
                    Open and view file
                  </Link>
                ) : (
                  <span>No file linked</span>
                )}
              </li>
            ))}
            {!materials?.length ? <li>No materials yet.</li> : null}
          </ul>
        </article>

        <article className="glass-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Assessments</h2>
            <Link className="btn-primary" href="/teacher/assessments/new">
              Create Assessment
            </Link>
          </div>

          <p className="mt-3 text-sm opacity-80">
            Open the full-page editor to generate and publish assessments with more space.
          </p>

          <ul className="mt-5 space-y-2 text-sm">
            {(assessments ?? []).map((assessment) => (
              <li key={assessment.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/teacher/assessments/${assessment.id}`} className="font-semibold underline hover:text-[var(--focus)]">
                    {assessment.title}
                  </Link>
                  <DeleteIconButton
                    action={deleteAssessment}
                    fieldName="assessmentId"
                    fieldValue={assessment.id}
                    ariaLabel={`Delete assessment ${assessment.title}`}
                    title="Delete assessment"
                    confirmMessage="Are you sure you want to delete this assessment?"
                  />
                </div>

                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold uppercase opacity-75">Questions</p>
                  {splitAssessmentLines(assessment.prompt).length ? (
                    <ol className="list-decimal space-y-1 pl-5">
                      {splitAssessmentLines(assessment.prompt).map((question, index) => (
                        <li key={`${assessment.id}-q-${index}`}>{question}</li>
                      ))}
                    </ol>
                  ) : (
                    <p>No questions set.</p>
                  )}
                </div>

                <p className="text-xs opacity-75">
                  Reference material: {assessment.reference_material_id ? materialTitleById.get(assessment.reference_material_id) || "Not found" : "Not set"}
                </p>
              </li>
            ))}
            {!assessments?.length ? <li>No assessments yet.</li> : null}
          </ul>
        </article>

        <article className="glass-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Student Results</h2>
          </div>

          <p className="mt-3 text-sm opacity-80">
            Select a student to view their submitted assessments and MC questions.
          </p>

          <div className="grid gap-3 mt-5 sm:grid-cols-2 lg:grid-cols-2">
            {(students ?? []).map((student) => (
              <Link
                key={student.id}
                href={`/teacher/students/${student.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--stroke)] hover:bg-[var(--stroke)] transition text-sm font-semibold"
              >
                <div className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 w-8 h-8 rounded-full flex items-center justify-center uppercase">
                  {(student.full_name || "S").charAt(0)}
                </div>
                <span>{student.full_name || "Unknown Student"}</span>
              </Link>
            ))}
            {!students?.length ? <p className="text-sm">No students found.</p> : null}
          </div>
        </article>

        <article className="glass-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Multiple Choice Questions</h2>
            <Link className="btn-primary" href="/teacher/mc/new">
              Create MC Questions
            </Link>
          </div>

          <p className="mt-3 text-sm opacity-80">
            Build MC questions manually or generate them by AI from your reference material.
          </p>

          <ul className="mt-5 space-y-2 text-sm">
            {(mcSets ?? []).map((set) => (
              <li key={set.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/teacher/mc/${set.id}`} className="font-semibold underline hover:text-[var(--focus)]">
                    {set.title}
                  </Link>
                  <DeleteIconButton
                    action={deleteMcSet}
                    fieldName="mcSetId"
                    fieldValue={set.id}
                    ariaLabel={`Delete MC set ${set.title}`}
                    title="Delete MC set"
                    confirmMessage="Are you sure you want to delete this MC set and all questions in it?"
                  />
                </div>

                <p className="mt-2 text-xs opacity-75">
                  Total questions: {mcQuestionCountBySetId.get(set.id) ?? 0}
                </p>
                <p className="text-xs opacity-75">
                  Reference material: {set.reference_material_id ? materialTitleById.get(set.reference_material_id) || "Not found" : "Not set"}
                </p>
              </li>
            ))}
            {!mcSets?.length ? <li>No MC sets yet.</li> : null}
          </ul>
        </article>

       
      </section>
    </main>
  );
}
