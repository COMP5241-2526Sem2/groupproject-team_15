import Link from "next/link";
import { redirect } from "next/navigation";
import { createAssessment, createMaterial, signOut } from "@/app/actions";
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
    .select("id, title, prompt, rubric, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  const { data: interactions } = await supabase
    .from("interactions")
    .select("prompt_type, content, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

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
              name="fileUrl"
              className="field"
              placeholder="https://... (PDF, PPT, image URL)"
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
                <a className="underline" href={material.file_url || "#"}>
                  {material.file_url ? "Open file" : "No file linked"}
                </a>
              </li>
            ))}
            {!materials?.length ? <li>No materials yet.</li> : null}
          </ul>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-2xl font-semibold">Create Adaptive Assessment</h2>
          <form action={createAssessment} className="mt-4 space-y-3">
            <input name="title" className="field" placeholder="Assessment title" required />
            <textarea
              name="prompt"
              className="field min-h-24"
              placeholder="Core question or task"
              required
            />
            <textarea
              name="rubric"
              className="field min-h-24"
              placeholder="Rubric for partial-credit grading"
            />
            <button className="btn-primary" type="submit">
              Publish Assessment
            </button>
          </form>

          <ul className="mt-5 space-y-2 text-sm">
            {(assessments ?? []).map((assessment) => (
              <li key={assessment.id} className="rounded-lg border border-[var(--stroke)] p-3">
                <p className="font-semibold">{assessment.title}</p>
                <p>{assessment.prompt}</p>
                <p className="text-xs opacity-75">Rubric: {assessment.rubric || "Not set"}</p>
              </li>
            ))}
            {!assessments?.length ? <li>No assessments yet.</li> : null}
          </ul>
        </article>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-2xl font-semibold">Recent Student-AI Interactions</h2>
        <p className="mt-2 text-sm">
          Use these logs for process-based grading and identifying common misconceptions.
        </p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {(interactions ?? []).map((interaction, idx) => (
            <li key={`${interaction.created_at}-${idx}`} className="rounded-lg border border-[var(--stroke)] p-3 text-sm">
              <span className="chip">{interaction.prompt_type}</span>
              <p className="mt-2">{interaction.content}</p>
            </li>
          ))}
          {!interactions?.length ? <li>No interaction logs yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
