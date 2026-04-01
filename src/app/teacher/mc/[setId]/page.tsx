import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import McQuestionForm from "@/app/teacher/mc-question-form";
import type { McQuestionItem } from "@/app/actions";

type EditTeacherMcPageProps = {
  params: Promise<{ setId: string }>;
};

export default async function EditTeacherMcPage({ params }: EditTeacherMcPageProps) {
  const resolvedParams = await params;
  const setId = resolvedParams.setId;

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

  const { data: mcSet } = await supabase
    .from("mc_sets")
    .select("id, title, reference_material_id")
    .eq("id", setId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!mcSet) notFound();

  const { data: mcQuestions } = await supabase
    .from("mc_questions")
    .select("id, question, option_a, option_b, option_c, option_d, correct_option, explanation")
    .eq("set_id", setId)
    .order("created_at", { ascending: true });

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const items: McQuestionItem[] = (mcQuestions ?? []).map((q: any) => ({
    question: q.question || "",
    optionA: q.option_a || "",
    optionB: q.option_b || "",
    optionC: q.option_c || "",
    optionD: q.option_d || "",
    correctOption: (q.correct_option as "A" | "B" | "C" | "D") || "A",
    explanation: q.explanation || "",
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Edit MC Questions</span>
          <h1 className="mt-2 text-2xl font-semibold">Editing: {mcSet.title}</h1>
        </div>
        <Link href="/teacher" className="btn-secondary">
          Back to Dashboard
        </Link>
      </header>

      <div className="glass-card p-6">
        <McQuestionForm
          materials={materials ?? []}
          setId={mcSet.id}
          initialTitle={mcSet.title}
          initialItems={items.length > 0 ? items : undefined}
          initialReferenceMaterialIds={mcSet.reference_material_id ? [mcSet.reference_material_id] : []}
        />
      </div>
    </main>
  );
}
