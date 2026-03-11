import Link from "next/link";
import { redirect } from "next/navigation";
import { createMaterial, signOut } from "@/app/actions";
import AssessmentForm from "@/app/teacher/assessment-form";
import { createClient } from "@/lib/supabase/server";

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

  const materialTitleById = new Map((materials ?? []).map((material) => [material.id, material.title]));

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
                <p className="font-semibold">{material.title}</p>
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
          <h2 className="text-2xl font-semibold">Create Adaptive Assessment</h2>
          <AssessmentForm
            materials={(materials ?? []).map((material) => ({
              id: material.id,
              title: material.title,
            }))}
          />

          <ul className="mt-5 space-y-2 text-sm">
            {(assessments ?? []).map((assessment) => (
              <li key={assessment.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <p className="font-semibold">{assessment.title}</p>
                <p>{assessment.prompt}</p>
                <p className="text-xs opacity-75">Answer: {assessment.answer || "Not set"}</p>
                <p className="text-xs opacity-75">
                  Reference material: {assessment.reference_material_id ? materialTitleById.get(assessment.reference_material_id) || "Not found" : "Not set"}
                </p>
              </li>
            ))}
            {!assessments?.length ? <li>No assessments yet.</li> : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
