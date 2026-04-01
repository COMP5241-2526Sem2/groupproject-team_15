import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AssessmentForm from "@/app/teacher/assessment-form";
import DeleteIconButton from "@/app/teacher/delete-icon-button";
import { deleteAssessment } from "@/app/actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

function splitStructuredLines(text: string | null) {
  return (text ?? "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^\s*(?:question|answer|q|a)?\s*\d+[\s).:-]*/i, "")
        .replace(/^\s*[-*]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

export default async function EditAssessmentPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, prompt, answer, reference_material_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assessment) {
    redirect("/teacher");
  }

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title")
    .eq("teacher_id", user.id)
    .order("title", { ascending: true });

  const initialQuestions = splitStructuredLines(assessment.prompt);
  const initialAnswers = splitStructuredLines(assessment.answer);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Edit Assessment</h1>
          <p className="mt-1 text-sm opacity-80">Make changes to your existing assessment setup.</p>
        </div>
        <div className="flex items-center gap-3">
          <DeleteIconButton
            action={deleteAssessment}
            fieldName="assessmentId"
            fieldValue={id}
            ariaLabel="Delete this assessment"
            title="Delete this assessment entirely"
            confirmMessage="Are you sure you want to delete this assessment? This cannot be undone."
          />
          <Link href="/teacher" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </header>

      <div className="glass-card p-6">
        <AssessmentForm
          materials={materials ?? []}
          assessmentId={id}
          initialTitle={assessment.title}
          initialQuestions={initialQuestions.length > 0 ? initialQuestions : [""]}
          initialAnswers={initialAnswers.length > 0 ? initialAnswers : [""]}
          initialReferenceMaterialIds={assessment.reference_material_id ? [assessment.reference_material_id] : []}
        />
      </div>
    </main>
  );
}
