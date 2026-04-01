import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export default async function TeacherStudentMcResultsPage({
  params,
}: {
  params: Promise<{ id: string; setId: string }>;
}) {
  const { id: studentId, setId } = await params;
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

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", studentId)
    .maybeSingle();

  if (!studentProfile || studentProfile.role !== "student") {
    notFound();
  }

  const { data: setRow } = await supabase
    .from("mc_sets")
    .select("id, title")
    .eq("id", setId)
    .eq("teacher_id", user.id) // Ensure teacher owns this set
    .maybeSingle();

  if (!setRow) {
    notFound();
  }

  const { data: questions } = await supabase
    .from("mc_questions")
    .select("id, question, option_a, option_b, option_c, option_d, correct_option")
    .eq("set_id", setId)
    .order("created_at", { ascending: true });

  if (!questions?.length) {
    notFound();
  }

  const { data: submissions } = await supabase
    .from("mc_submissions")
    .select("question_id, selected_option, is_correct, created_at")
    .eq("set_id", setId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  // Get the latest submission for each question
  const latestSubmissions = new Map<string, { selected_option: string; is_correct: boolean }>();
  for (const sub of submissions ?? []) {
    if (!latestSubmissions.has(sub.question_id)) {
      latestSubmissions.set(sub.question_id, sub);
    }
  }

  let totalCorrect = 0;
  for (const q of questions) {
    if (latestSubmissions.get(q.id)?.is_correct) {
      totalCorrect++;
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Student MC Results</span>
          <h1 className="mt-2 text-3xl font-semibold">{setRow.title}</h1>
          <p className="text-sm">
            {studentProfile.full_name} scored {totalCorrect} out of {questions.length} (
            {Math.round((totalCorrect / questions.length) * 100)}%)
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/teacher/students/${studentId}`} className="btn-secondary">
            Back to Student
          </Link>
          <form action={signOut}>
            <button className="btn-primary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="space-y-4">
        {questions.map((question, index) => {
          const submission = latestSubmissions.get(question.id);
          const answered = !!submission;
          const isCorrect = submission?.is_correct;
          const selected = submission?.selected_option;

          return (
            <div
              key={question.id}
              className={`glass-card p-6 border-l-4 ${
                !answered
                  ? "border-yellow-500"
                  : isCorrect
                  ? "border-green-500"
                  : "border-red-500"
              }`}
            >
              <h2 className="text-lg font-semibold mb-2">
                Question {index + 1}
                {answered && (
                  <span
                    className={`ml-3 text-sm font-medium px-2 py-0.5 rounded ${
                      isCorrect
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {isCorrect ? "Correct" : "Incorrect"}
                  </span>
                )}
                {!answered && (
                  <span className="ml-3 text-sm font-medium px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Not Answered
                  </span>
                )}
              </h2>
              <p className="mb-4 text-sm">{question.question}</p>

              <div className="space-y-2 text-sm">
                {(["A", "B", "C", "D"] as const).map((opt) => {
                  const optionText =
                    opt === "A"
                      ? question.option_a
                      : opt === "B"
                      ? question.option_b
                      : opt === "C"
                      ? question.option_c
                      : question.option_d;

                  const isSelected = selected === opt;
                  const isActuallyCorrect = question.correct_option === opt;

                  let bgColor = "bg-[var(--bg-primary)]";
                  if (isActuallyCorrect) {
                    bgColor = "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
                  } else if (isSelected && !isActuallyCorrect) {
                    bgColor = "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
                  }

                  return (
                    <div
                      key={opt}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-[var(--stroke)] ${bgColor}`}
                    >
                      <div className="font-medium mt-0.5">{opt}.</div>
                      <div className="flex-1">{optionText}</div>
                      {isSelected && (
                        <div className="font-semibold text-xs uppercase px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mt-[-2px]">
                          Student's Answer
                        </div>
                      )}
                      {isActuallyCorrect && (
                        <div className="font-semibold text-xs uppercase px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mt-[-2px]">
                          Correct Answer
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}