import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signOut, submitMcAnswers } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function StudentMcSetPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;
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

  const { data: setRow } = await supabase
    .from("mc_sets")
    .select("id, title")
    .eq("id", setId)
    .maybeSingle();

  if (!setRow) {
    notFound();
  }

  const { data: questions } = await supabase
    .from("mc_questions")
    .select("id, question, option_a, option_b, option_c, option_d")
    .eq("set_id", setId)
    .order("created_at", { ascending: true });

  if (!questions?.length) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">MC Practice</span>
          <h1 className="mt-2 text-3xl font-semibold">{setRow.title}</h1>
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

      <section className="glass-card p-6">
        <h2 className="text-2xl font-semibold">Answer MC Questions</h2>
        <p className="mt-2 text-sm">Select one option for each question, then submit.</p>

        <form action={submitMcAnswers} className="mt-4 space-y-4">
          <input type="hidden" name="setId" value={setId} />

          {questions.map((question, index) => (
            <fieldset key={question.id} className="rounded-lg border border-[var(--stroke)] p-4">
              <legend className="px-1 text-sm font-semibold">Question {index + 1}</legend>
              <p className="mb-3 text-sm">{question.question}</p>

              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name={`answer_${question.id}`} value="A" required />
                  <span>A. {question.option_a}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name={`answer_${question.id}`} value="B" required />
                  <span>B. {question.option_b}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name={`answer_${question.id}`} value="C" required />
                  <span>C. {question.option_c}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name={`answer_${question.id}`} value="D" required />
                  <span>D. {question.option_d}</span>
                </label>
              </div>
            </fieldset>
          ))}

          <button className="btn-primary" type="submit">
            Submit MC Answers
          </button>
        </form>
      </section>
    </main>
  );
}
