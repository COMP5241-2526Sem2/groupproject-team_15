import Link from "next/link";
import { redirect } from "next/navigation";
import AssessmentForm from "@/app/teacher/assessment-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewTeacherAssessmentPage() {
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
    .select("id, title, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="chip">Assessment Editor</span>
            <h1 className="mt-2 text-3xl font-semibold">Create Adaptive Assessment</h1>
            <p className="text-sm opacity-80">
              Generate by AI, refine the fields, and publish when ready.
            </p>
          </div>
          <Link href="/teacher" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <section className="glass-card p-6">
        <AssessmentForm
          materials={(materials ?? []).map((material) => ({
            id: material.id,
            title: material.title,
          }))}
        />
      </section>
    </main>
  );
}
